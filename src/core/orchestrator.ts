import { TaskRouter } from './router.js';
import { LocalExecutor } from './local-executor.js';
import { ClaudeClient } from '../claude/client.js';
import { ClaudeSupervisor } from '../claude/supervisor.js';
import { ContextOptimizer } from './context_optimizer.js';
import { MemoryManager } from './memory-manager.js';
import { EscalationManager } from './escalation.js';
import { CodeIndexer } from '../retrieval/indexer.js';
import { Embedder } from '../retrieval/embedder.js';
import {
  TaskContext,
  ModelResponse,
  RoutingConfig,
  ModelConfig,
  UsageMetrics,
  RoutingDecision
} from '../types/index.js';
import logger, { tokenLogger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AIOrchestrator {
  private router: TaskRouter;
  private localExecutor: LocalExecutor;
  private claudeClient: ClaudeClient;
  private supervisor: ClaudeSupervisor;
  private contextOptimizer: ContextOptimizer;
  private memoryManager: MemoryManager;
  private escalationManager: EscalationManager;
  private indexer?: CodeIndexer;
  private routingConfig: RoutingConfig;
  private modelConfig: ModelConfig;
  private metrics: UsageMetrics;

  constructor(routingConfig: RoutingConfig, modelConfig: ModelConfig, claudeApiKey: string, bedrockBaseURL?: string) {
    this.routingConfig = routingConfig;
    this.modelConfig = modelConfig;

    this.router = new TaskRouter(routingConfig, modelConfig);

    const enableTools = process.env.ENABLE_LOCAL_TOOLS !== 'false';
    this.localExecutor = new LocalExecutor(
      modelConfig.models.codeEditor.name,
      modelConfig.models.compressor.name,
      enableTools
    );

    const tokenBudget = parseInt(process.env.CLAUDE_TOKEN_BUDGET || '8000', 10);
    this.claudeClient = new ClaudeClient(claudeApiKey, tokenBudget, bedrockBaseURL);
    this.supervisor = new ClaudeSupervisor(
      this.claudeClient,
      routingConfig.escalation.allowClaudeOverride
    );

    this.contextOptimizer = new ContextOptimizer(routingConfig);
    this.memoryManager = new MemoryManager(
      routingConfig,
      modelConfig.models.compressor.name
    );
    this.escalationManager = new EscalationManager();

    this.metrics = {
      totalRequests: 0,
      localRequests: 0,
      claudeRequests: 0,
      tokensSaved: 0,
      claudeTokensUsed: 0,
      avgLatency: 0
    };
  }

  async initialize(): Promise<void> {
    const embedder = new Embedder(this.modelConfig.models.embedding.name);
    const indexPath = path.join(__dirname, '../../embeddings/code-index.json');
    this.indexer = new CodeIndexer(embedder, indexPath);

    try {
      await this.indexer.load();
    } catch (error) {
      // Indexer handles logging internally
    }

    // Initialize local executor with tool support
    await this.localExecutor.initialize();

    logger.debug('AI Orchestrator initialized');
  }

  async process(input: string, codeContext?: string, forceModel?: string): Promise<ModelResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    this.memoryManager.addTurn('user', input);

    const context: TaskContext = {
      input,
      codeContext,
      fileCount: codeContext ? this.estimateFileCount(codeContext) : undefined,
      history: this.memoryManager.getRecentHistory(2000)
    };

    const decision = await this.router.route(context);

    // Handle forced model override
    if (forceModel) {
      const forceLower = forceModel.toLowerCase();
      if (forceLower === 'claude') {
        decision.target = 'claude';
        logger.debug('Forcing Claude model');
      } else if (forceLower === 'local') {
        decision.target = decision.taskType === 'explanation' ? 'local_compress' : 'local_code';
        logger.debug('Forcing local model');
      }
    } else {
      // Only apply supervisor override if model is not forced
      const override = await this.supervisor.shouldOverrideRouting(decision, input);
      if (override.override) {
        this.escalationManager.logEscalation(
          decision,
          decision.target,
          override.reason || 'Supervisor override'
        );
        decision.target = 'claude';
      }
    }

    let response: ModelResponse;

    if (decision.target === 'claude') {
      try {
        response = await this.executeWithClaude(input, codeContext, context);
        this.metrics.claudeRequests++;
        this.metrics.claudeTokensUsed += response.tokens;
      } catch (error: any) {
        response = await this.handleClaudeFailure(error, decision, input, codeContext, context);
      }
    } else {
      response = await this.executeLocally(decision.target, input, codeContext);
      this.metrics.localRequests++;

      const estimatedClaudeTokens = Math.ceil(response.tokens * 1.5);
      this.metrics.tokensSaved += estimatedClaudeTokens;
    }

    this.memoryManager.addTurn('assistant', response.content);

    const totalLatency = Date.now() - startTime;
    this.metrics.avgLatency =
      (this.metrics.avgLatency * (this.metrics.totalRequests - 1) + totalLatency) /
      this.metrics.totalRequests;

    this.logRequest(decision, response, totalLatency);

    return response;
  }

  private async handleClaudeFailure(
    error: any,
    decision: RoutingDecision,
    input: string,
    codeContext: string | undefined,
    context: TaskContext
  ): Promise<ModelResponse> {
    const errorMessage = this.getClaudeErrorMessage(error);

    logger.debug('Claude API failed, attempting local fallback', {
      error: error.message,
      errorType: error.errorType || 'unknown',
      taskType: decision.taskType,
      complexity: decision.complexity
    });

    this.escalationManager.logEscalation(
      { ...decision, target: 'local_code' },
      'claude',
      `Claude failed: ${errorMessage}`
    );

    const fallbackTarget = decision.taskType === 'explanation'
      ? 'local_compress'
      : 'local_code';

    try {
      const localResponse = await this.executeLocally(fallbackTarget, input, codeContext);

      this.metrics.localRequests++;
      const estimatedClaudeTokens = Math.ceil(localResponse.tokens * 1.5);
      this.metrics.tokensSaved += estimatedClaudeTokens;

      const fallbackNotice = this.formatFallbackNotice(errorMessage);

      return {
        ...localResponse,
        content: `${localResponse.content}`,
      };
    } catch (localError) {
      logger.debug('Local fallback also failed', { error: localError });

      return {
        content: `${errorMessage}\n\nUnfortunately, local models also encountered an error. Please try:\n1. Simplifying your request\n2. Checking your connection\n3. Verifying Ollama is running: curl http://localhost:11434/api/version`,
        model: 'error',
        tokens: 0,
        latency: 0
      };
    }
  }

  private getClaudeErrorMessage(error: any): string {
    if (error.errorType === 'credits_exhausted') {
      return '⚠️ Claude API credits exhausted. Falling back to FREE local model.';
    }

    if (error.errorType === 'budget_exceeded') {
      return '⚠️ Session token budget reached. Falling back to FREE local model.';
    }

    if (error.errorType === 'rate_limit') {
      return '⚠️ Claude API rate limit reached. Falling back to FREE local model.';
    }

    if (error.errorType === 'invalid_api_key') {
      return '⚠️ Claude API key invalid or not set. Using FREE local model.';
    }

    if (error.errorType === 'network_error') {
      return '⚠️ Network error reaching Claude API. Falling back to FREE local model.';
    }

    return '⚠️ Claude API unavailable. Falling back to FREE local model.';
  }

  private formatFallbackNotice(errorMessage: string): string {
    // Clean, minimal notice for production use
    return '';
  }

  async indexCodebase(files: { path: string; content: string }[]): Promise<void> {
    if (!this.indexer) {
      throw new Error('Indexer not initialized');
    }

    for (const file of files) {
      await this.indexer.indexCode(file.path, file.content);
    }

    await this.indexer.save();
    logger.info('Codebase indexed', { files: files.length });
  }

  async searchCode(query: string, topK: number = 5): Promise<string> {
    if (!this.indexer) {
      return '';
    }

    const results = await this.indexer.search(query, topK);
    return results
      .map(chunk => `// ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`)
      .join('\n\n');
  }

  getMetrics(): UsageMetrics {
    return { ...this.metrics };
  }

  getClaudeTokensUsed(): number {
    return this.claudeClient.getTokensUsed();
  }

  resetSession(): void {
    this.memoryManager.clear();
    this.claudeClient.resetTokenCounter();
    logger.info('Session reset');
  }

  private async executeLocally(
    target: 'local_code' | 'local_compress',
    prompt: string,
    context?: string
  ): Promise<ModelResponse> {
    let optimizedContext = context;

    if (context) {
      const optimized = this.contextOptimizer.optimize(context);
      optimizedContext = optimized.optimized;

      logger.debug('Context optimized for local execution', {
        tokensSaved: optimized.tokensSaved,
        operations: optimized.operations
      });
    }

    return await this.localExecutor.execute(target, prompt, optimizedContext);
  }

  private async executeWithClaude(
    prompt: string,
    context: string | undefined,
    taskContext: TaskContext
  ): Promise<ModelResponse> {
    let optimizedContext = context;

    if (context) {
      const optimized = this.contextOptimizer.optimize(context);
      optimizedContext = optimized.optimized;

      logger.debug('Context optimized for Claude', {
        tokensSaved: optimized.tokensSaved,
        operations: optimized.operations
      });
    }

    if (this.indexer && taskContext.input.includes('search') || taskContext.input.includes('find')) {
      const retrievedCode = await this.searchCode(taskContext.input, 3);
      if (retrievedCode) {
        optimizedContext = retrievedCode + (optimizedContext ? `\n\n${optimizedContext}` : '');
      }
    }

    return await this.claudeClient.generate(
      prompt,
      optimizedContext,
      taskContext.history
    );
  }

  private estimateFileCount(codeContext: string): number {
    const fileIndicators = codeContext.match(/\/\/ .+\.(ts|js|py|java|go|rs)/g);
    return fileIndicators ? fileIndicators.length : 1;
  }

  private logRequest(
    decision: any,
    response: ModelResponse,
    latency: number
  ): void {
    tokenLogger.info('Request processed', {
      target: decision.target,
      taskType: decision.taskType,
      complexity: decision.complexity,
      model: response.model,
      tokens: response.tokens,
      latency,
      totalRequests: this.metrics.totalRequests,
      localRatio: this.metrics.localRequests / this.metrics.totalRequests,
      tokensSaved: this.metrics.tokensSaved
    });
  }
}
