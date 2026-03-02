import { TaskRouter } from './router.js';
import { LocalExecutor } from './local-executor.js';
import { ClaudeClient } from '../claude/client.js';
import { CursorClient } from '../cursor/client.js';
import { ClaudeSupervisor } from '../claude/supervisor.js';
import { ContextOptimizer } from './context_optimizer.js';
import { MemoryManager } from './memory-manager.js';
import { EscalationManager } from './escalation.js';
import { RateLimitCache } from './rate-limit-cache.js';
import { CodeIndexer } from '../retrieval/indexer.js';
import { Embedder } from '../retrieval/embedder.js';
import { SkillTracker } from './skill-tracker.js';
import {
  TaskContext,
  ModelResponse,
  RoutingConfig,
  ModelConfig,
  UsageMetrics,
  RoutingDecision,
  RouteTarget
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
  private cursorClient: CursorClient;
  private claudeClient: ClaudeClient;
  private supervisor: ClaudeSupervisor;
  private contextOptimizer: ContextOptimizer;
  private memoryManager: MemoryManager;
  private escalationManager: EscalationManager;
  private rateLimitCache: RateLimitCache;
  private indexer?: CodeIndexer;
  private skillTracker: SkillTracker;
  private routingConfig: RoutingConfig;
  private modelConfig: ModelConfig;
  private metrics: UsageMetrics;

  constructor(routingConfig: RoutingConfig, modelConfig: ModelConfig, claudeApiKey: string, bedrockBaseURL?: string, sessionId?: string) {
    this.routingConfig = routingConfig;
    this.modelConfig = modelConfig;

    this.router = new TaskRouter(routingConfig, modelConfig);

    const enableTools = process.env.ENABLE_LOCAL_TOOLS !== 'false';
    this.localExecutor = new LocalExecutor(
      modelConfig.models.codeEditor.name,
      modelConfig.models.compressor.name,
      modelConfig.models.general.name,
      modelConfig.models.embedding.name,
      enableTools
    );

    const tokenBudget = parseInt(process.env.CLAUDE_TOKEN_BUDGET || '8000', 10);
    this.cursorClient = new CursorClient();
    this.claudeClient = new ClaudeClient(claudeApiKey, tokenBudget, bedrockBaseURL);
    this.supervisor = new ClaudeSupervisor(
      this.claudeClient,
      routingConfig.escalation.allowClaudeOverride
    );

    this.contextOptimizer = new ContextOptimizer(routingConfig);
    this.memoryManager = new MemoryManager(
      routingConfig,
      modelConfig.models.compressor.name,
      sessionId
    );
    this.escalationManager = new EscalationManager();
    this.skillTracker = new SkillTracker();

    // Rate limit cache with configurable duration (default 4 hours)
    const rateLimitHours = parseInt(process.env.RATE_LIMIT_CACHE_HOURS || '4', 10);
    this.rateLimitCache = new RateLimitCache(rateLimitHours);

    this.metrics = {
      totalRequests: 0,
      localRequests: 0,
      cursorRequests: 0,
      claudeRequests: 0,
      tokensSaved: 0,
      cursorTokensUsed: 0,
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

    // Initialize local executor with tool support and skill tracker
    await this.localExecutor.initialize();
    this.localExecutor.setSkillTracker(this.skillTracker);

    // Load skill stats
    await this.skillTracker.load();

    // Load rate limit cache
    await this.rateLimitCache.load();

    // Initialize memory manager and load session if exists
    await this.memoryManager.initialize();

    logger.debug('AI Orchestrator initialized');
  }

  getSkillTracker(): SkillTracker {
    return this.skillTracker;
  }

  getSessionId(): string {
    return this.memoryManager.getSessionId();
  }

  async saveSession(): Promise<void> {
    await this.memoryManager.saveSession();
  }

  async listRecentSessions(): Promise<{ id: string; lastUpdated: number; turnCount: number }[]> {
    return await this.memoryManager.listRecentSessions();
  }

  async getToolCounts(): Promise<{ skills: number; mcps: number }> {
    return await this.localExecutor.getToolCounts();
  }

  async process(input: string, codeContext?: string, forceModel?: string): Promise<ModelResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    this.memoryManager.addTurn('user', input);

    const context: TaskContext = {
      input,
      codeContext,
      fileCount: codeContext ? this.estimateFileCount(codeContext) : undefined,
      history: this.memoryManager.getRecentHistory(500) // Reduced for faster local model responses
    };

    const decision = await this.router.route(context);

    // Handle forced model override
    if (forceModel) {
      const forceLower = forceModel.toLowerCase();
      if (forceLower === 'claude') {
        decision.target = 'claude';
        logger.debug('Forcing Claude model');
      } else if (forceLower === 'local') {
        // Keep the router's decision (it already chose local_code/local_compress/local_general)
        logger.debug('Forcing local model', { target: decision.target });
      }
    } else {
      // Only apply supervisor override if model is not forced
      // Skip supervisor for direct skill invocations (they're meant to run locally)
      const isSkillInvocation = input.trim().startsWith('/');

      if (!isSkillInvocation) {
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
    }

    // Check rate limit cache for paid models and fallback if needed
    if (decision.target === 'claude' && this.rateLimitCache.isRateLimited('claude')) {
      logger.warn('Claude is rate limited, falling back to Cursor or local');
      decision.target = this.rateLimitCache.isRateLimited('cursor') ? 'local_general' : 'cursor';
    } else if (decision.target === 'cursor' && this.rateLimitCache.isRateLimited('cursor')) {
      logger.warn('Cursor is rate limited, falling back to local');
      decision.target = 'local_general';
    }

    let response: ModelResponse;

    if (decision.target === 'claude') {
      try {
        response = await this.executeWithClaude(input, codeContext, context);
        this.metrics.claudeRequests++;
        this.metrics.claudeTokensUsed += response.tokens;
      } catch (error: any) {
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          await this.rateLimitCache.markRateLimited('claude', error.message);
        }
        response = await this.handleClaudeFailure(error, decision, input, codeContext, context);
      }
    } else if (decision.target === 'cursor') {
      try {
        response = await this.executeWithCursor(input, codeContext, context);
        this.metrics.cursorRequests++;
        this.metrics.cursorTokensUsed += response.tokens;

        // Cursor is cheaper than Claude but more expensive than Ollama
        const estimatedClaudeTokens = Math.ceil(response.tokens * 1.2);
        this.metrics.tokensSaved += estimatedClaudeTokens;
      } catch (error: any) {
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          await this.rateLimitCache.markRateLimited('cursor', error.message);
        }
        // Fallback to Claude if Cursor fails
        logger.warn('Cursor execution failed, falling back to Claude', { error: error.message });
        response = await this.handleCursorFailure(error, decision, input, codeContext, context);
      }
    } else {
      // Use the router's decision (already chose local_code/local_compress/local_general based on tool requirements)
      const formattedHistory = this.formatHistoryForLocal(context.history);
      response = await this.executeLocally(decision.target, input, codeContext, formattedHistory);
      this.metrics.localRequests++;

      const estimatedClaudeTokens = Math.ceil(response.tokens * 1.5);
      this.metrics.tokensSaved += estimatedClaudeTokens;
    }

    this.memoryManager.addTurn('assistant', response.content);

    // Auto-save session after each interaction
    await this.memoryManager.saveSession();

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
      decision,
      'claude',
      `Claude failed: ${errorMessage}`
    );

    // Use the original router decision for fallback (only local targets)
    const fallbackTarget =
      decision.target === 'claude' || decision.target === 'cursor'
        ? 'local_code'
        : decision.target;

    try {
      const formattedHistory = this.formatHistoryForLocal(context.history);
      const localResponse = await this.executeLocally(fallbackTarget, input, codeContext, formattedHistory);

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
    target: 'local_code' | 'local_compress' | 'local_general',
    prompt: string,
    context?: string,
    history?: string
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

    return await this.localExecutor.execute(target, prompt, optimizedContext, history);
  }

  private async executeWithCursor(
    prompt: string,
    context: string | undefined,
    taskContext: TaskContext
  ): Promise<ModelResponse> {
    if (!this.cursorClient.isAvailable()) {
      throw new Error('Cursor client not available. Set CURSOR_API_KEY environment variable.');
    }

    let optimizedContext = context;

    if (context) {
      const optimized = this.contextOptimizer.optimize(context);
      optimizedContext = optimized.optimized;

      logger.debug('Context optimized for Cursor', {
        tokensSaved: optimized.tokensSaved,
        operations: optimized.operations
      });
    }

    // Build full prompt with history
    let fullPrompt = prompt;
    if (taskContext.history && taskContext.history.length > 0) {
      const historyText = this.formatHistoryForLocal(taskContext.history);
      fullPrompt = `${historyText}\n\nUser: ${prompt}`;
    }

    const response = await this.cursorClient.generate(fullPrompt, optimizedContext);

    return {
      content: response.content,
      model: response.model,
      tokens: response.tokens,
      latency: 0 // Latency tracked internally
    };
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

  private async handleCursorFailure(
    error: any,
    decision: RoutingDecision,
    input: string,
    codeContext: string | undefined,
    context: TaskContext
  ): Promise<ModelResponse> {
    logger.warn('Cursor failed, escalating to Claude', {
      error: error.message,
      originalTarget: decision.target
    });

    this.escalationManager.logEscalation(decision, 'claude', `Cursor failure: ${error.message}`);

    // Fallback to Claude
    return await this.executeWithClaude(input, codeContext, context);
  }

  private estimateFileCount(codeContext: string): number {
    const fileIndicators = codeContext.match(/\/\/ .+\.(ts|js|py|java|go|rs)/g);
    return fileIndicators ? fileIndicators.length : 1;
  }

  private formatHistoryForLocal(history?: any[]): string | undefined {
    if (!history || history.length === 0) {
      return undefined;
    }

    return history
      .map(turn => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
      .join('\n\n');
  }

  /**
   * Check if an error is a rate limit error from the API
   */
  private isRateLimitError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorType = error.errorType?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;

    // Check for common rate limit indicators
    return (
      statusCode === 429 ||
      errorType === 'rate_limit_error' ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('quota exceeded')
    );
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

  /**
   * Get rate limit status (for /stats command)
   */
  getRateLimitStatus(): Array<{ target: string; minutesRemaining: number; reason?: string }> {
    return this.rateLimitCache.getRateLimitedModels();
  }

  /**
   * Clear rate limit for a model (admin command)
   */
  async clearRateLimit(target: RouteTarget): Promise<void> {
    await this.rateLimitCache.clearRateLimit(target);
  }
}
