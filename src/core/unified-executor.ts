import { TaskDecomposer, TaskPlan, TaskStep, TaskIntent } from './task-decomposer.js';
import { FileOperations, FileOpResult } from './file-operations.js';
import { ComputerUseExecutor } from './computer-use-executor.js';
import { LocalExecutor } from './local-executor.js';
import { ModelResponse } from '../types/index.js';
import logger from '../utils/logger.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { Ollama } from 'ollama';

/**
 * Execution context tracks state across steps
 */
interface ExecutionContext {
  generatedContent?: string;
  filePath?: string;
  results: string[];
}

/**
 * Unified Executor - The orchestrator that makes Kochava better than Claude Code
 *
 * Key improvements:
 * 1. Intelligent task decomposition - knows when to use LLM vs bash
 * 2. Multi-step execution - handles complex tasks like "create code.txt with fibonacci"
 * 3. Validation at every step - ensures operations actually worked
 * 4. Detailed progress tracking - shows what's happening at each step
 * 5. Error recovery - graceful fallbacks and helpful error messages
 * 6. Resource optimization - uses local models where possible, Claude for complex generation
 *
 * Architecture:
 * User Request → TaskDecomposer → Execution Plan → Step-by-step execution → Validation → Result
 *
 * Example flow:
 * "create fibonacci code in code.txt"
 * → COMPOUND intent detected
 * → Plan: [Generate code, Write to file, Validate]
 * → Execute Step 1: LLM generates fibonacci code
 * → Execute Step 2: FileOps writes to code.txt
 * → Execute Step 3: Validate file exists and not empty
 * → Result: "✓ Created code.txt (234 bytes, 12 lines)"
 */
export class UnifiedExecutor {
  private decomposer: TaskDecomposer;
  private fileOps: FileOperations;
  private computerUse: ComputerUseExecutor;
  private anthropic?: Anthropic;
  private ollama: Ollama;
  private codeModel: string;

  constructor() {
    this.decomposer = new TaskDecomposer('phi3');
    this.fileOps = new FileOperations();
    this.computerUse = new ComputerUseExecutor();
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.codeModel = 'qwen2.5-coder:7b'; // Fast local model for code generation

    // Initialize Claude API for code generation (optional, falls back to local)
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  }

  /**
   * Execute user request with intelligent task decomposition
   */
  async execute(userRequest: string): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      logger.info('Unified executor processing request', {
        request: userRequest.substring(0, 100)
      });

      // Step 1: Analyze and decompose the task
      const plan = await this.decomposer.analyze(userRequest);

      logger.debug('Execution plan created', {
        intent: plan.intent,
        steps: plan.steps.length,
        requiresGeneration: plan.metadata.requiresGeneration,
        requiresFileOps: plan.metadata.requiresFileOps
      });

      // Step 2: Execute the plan
      const result = await this.executePlan(plan, userRequest);

      const latency = Date.now() - startTime;

      return {
        content: result.content,
        model: result.model,
        tokens: result.tokens,
        latency
      };
    } catch (error: any) {
      logger.error('Unified executor failed', {
        error: error.message,
        request: userRequest.substring(0, 100)
      });

      return {
        content: `Error: ${error.message}`,
        model: 'unified-executor (error)',
        tokens: 0,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a task plan step by step
   */
  private async executePlan(plan: TaskPlan, originalRequest: string): Promise<ModelResponse> {
    // For simple READ operations, use computer-use directly
    if (plan.intent === TaskIntent.READ && plan.steps.length === 1) {
      return await this.computerUse.execute(originalRequest);
    }

    // For simple WRITE operations without generation, use computer-use
    if (plan.intent === TaskIntent.WRITE && !plan.metadata.requiresGeneration) {
      return await this.computerUse.execute(originalRequest);
    }

    // For pure GENERATE, use LLM
    if (plan.intent === TaskIntent.GENERATE && plan.steps.length === 1) {
      return await this.generateCode(originalRequest);
    }

    // For COMPOUND operations, execute multi-step plan
    if (plan.intent === TaskIntent.COMPOUND) {
      return await this.executeCompoundPlan(plan, originalRequest);
    }

    // Default: use computer-use executor
    return await this.computerUse.execute(originalRequest);
  }

  /**
   * Execute compound plan (generate + write + validate)
   */
  private async executeCompoundPlan(plan: TaskPlan, originalRequest: string): Promise<ModelResponse> {
    const context: ExecutionContext = {
      results: []
    };

    let totalTokens = 0;
    let modelUsed = 'unified-executor';

    // Execute each step
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      logger.debug(`Executing step ${i + 1}/${plan.steps.length}`, {
        action: step.action,
        executor: step.executor
      });

      const stepResult = await this.executeStep(step, context, originalRequest);

      if (!stepResult.success) {
        return {
          content: `Step ${i + 1} failed: ${stepResult.message}\n\nCompleted steps:\n${context.results.join('\n')}`,
          model: `${modelUsed} (failed at step ${i + 1})`,
          tokens: totalTokens,
          latency: 0
        };
      }

      context.results.push(`✓ Step ${i + 1}: ${stepResult.message}`);

      // Update context with step results
      if (step.action === 'generate' && stepResult.content) {
        context.generatedContent = stepResult.content;
      }
      if (step.params.filePath) {
        context.filePath = step.params.filePath;
      }

      // Track tokens and model
      if (stepResult.tokens) {
        totalTokens += stepResult.tokens;
      }
      if (stepResult.model) {
        modelUsed = stepResult.model;
      }
    }

    // Build final success message
    const summaryParts = [];

    if (context.filePath) {
      summaryParts.push(`Created: ${context.filePath}`);
    }

    // Get final file stats if available
    if (context.filePath && plan.metadata.requiresValidation) {
      const validation = await this.fileOps.validate(context.filePath, 'file-not-empty');
      if (validation.success) {
        summaryParts.push(`${validation.fileSize} bytes`);
        summaryParts.push(`${validation.lineCount} lines`);
      }
    }

    const summary = summaryParts.length > 0
      ? summaryParts.join(', ')
      : 'Operation completed successfully';

    const content = `${summary}\n\n${context.results.join('\n')}`;

    return {
      content,
      model: modelUsed,
      tokens: totalTokens,
      latency: 0
    };
  }

  /**
   * Execute a single step in the plan
   */
  private async executeStep(
    step: TaskStep,
    context: ExecutionContext,
    originalRequest: string
  ): Promise<{
    success: boolean;
    message: string;
    content?: string;
    tokens?: number;
    model?: string;
  }> {
    try {
      switch (step.action) {
        case 'generate':
          return await this.executeGenerateStep(step, originalRequest);

        case 'write':
          return await this.executeWriteStep(step, context);

        case 'execute':
          return await this.executeCommandStep(step, originalRequest);

        case 'validate':
          return await this.executeValidateStep(step, context);

        default:
          return {
            success: false,
            message: `Unknown action: ${step.action}`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Step execution failed: ${error.message}`
      };
    }
  }

  /**
   * Execute code generation step
   */
  private async executeGenerateStep(step: TaskStep, originalRequest: string): Promise<{
    success: boolean;
    message: string;
    content?: string;
    tokens?: number;
    model?: string;
  }> {
    const prompt = step.params.prompt || originalRequest;

    // Try Claude API first (best quality for code generation)
    if (this.anthropic) {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: `${prompt}\n\nOutput ONLY the code with NO explanations, NO markdown, NO comments. Just pure code.`
          }]
        });

        const content = response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : '';

        // Clean up any markdown that snuck in
        const cleanedContent = this.cleanGeneratedCode(content);

        return {
          success: true,
          message: 'Code generated',
          content: cleanedContent,
          tokens: response.usage.input_tokens + response.usage.output_tokens,
          model: 'claude-3.5-sonnet'
        };
      } catch (error: any) {
        logger.warn('Claude generation failed, trying local', { error: error.message });
      }
    }

    // Fallback to local model (free but lower quality)
    const localResult = await this.generateCode(prompt);
    return {
      success: localResult.content.length > 0,
      message: localResult.content.length > 0 ? 'Code generated (local)' : 'Generation failed',
      content: localResult.content,
      tokens: localResult.tokens,
      model: localResult.model
    };
  }

  /**
   * Execute file write step
   */
  private async executeWriteStep(step: TaskStep, context: ExecutionContext): Promise<{
    success: boolean;
    message: string;
  }> {
    const filePath = step.params.filePath;
    const content = context.generatedContent;

    if (!filePath) {
      return {
        success: false,
        message: 'No file path specified'
      };
    }

    if (!content) {
      return {
        success: false,
        message: 'No content to write'
      };
    }

    const result = await this.fileOps.create(filePath, content);
    return {
      success: result.success,
      message: result.message
    };
  }

  /**
   * Execute command step
   */
  private async executeCommandStep(step: TaskStep, originalRequest: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const command = step.params.command || originalRequest;
    const result = await this.computerUse.execute(command);

    return {
      success: !result.content.startsWith('Error:'),
      message: result.content
    };
  }

  /**
   * Execute validation step
   */
  private async executeValidateStep(step: TaskStep, context: ExecutionContext): Promise<{
    success: boolean;
    message: string;
  }> {
    const filePath = step.params.filePath || context.filePath;
    const validationType = step.params.validationType || 'file-exists';

    if (!filePath) {
      return {
        success: false,
        message: 'No file path to validate'
      };
    }

    const result = await this.fileOps.validate(filePath, validationType);
    return {
      success: result.success,
      message: result.message
    };
  }

  /**
   * Generate code using local LLM (fallback when Claude not available)
   */
  private async generateCode(prompt: string): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      logger.debug('Generating code with local model', {
        model: this.codeModel,
        prompt: prompt.substring(0, 100)
      });

      const response = await this.ollama.generate({
        model: this.codeModel,
        prompt: `${prompt}\n\nOutput ONLY the code. No explanations, no markdown, no comments. Just pure, clean code.`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1000,
          top_p: 0.9
        }
      });

      const cleanedCode = this.cleanGeneratedCode(response.response);

      const latency = Date.now() - startTime;

      logger.debug('Local code generation complete', {
        length: cleanedCode.length,
        latency
      });

      return {
        content: cleanedCode,
        model: this.codeModel,
        tokens: 0, // Local model, no API tokens
        latency
      };
    } catch (error: any) {
      logger.error('Local code generation failed', { error: error.message });

      return {
        content: `Error generating code: ${error.message}`,
        model: 'unified-executor (error)',
        tokens: 0,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Clean up generated code (remove markdown, explanations, etc.)
   */
  private cleanGeneratedCode(code: string): string {
    let cleaned = code.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```[\w]*\n?/gm, '');
    cleaned = cleaned.replace(/\n?```$/gm, '');

    // Remove leading/trailing explanations (common pattern: "Here's the code:\n\n")
    cleaned = cleaned.replace(/^.*?(?:here'?s?|here is|this is).*?code.*?:?\n+/i, '');
    cleaned = cleaned.replace(/\n+.*?(?:explanation|note|this|the above).*$/is, '');

    return cleaned.trim();
  }
}
