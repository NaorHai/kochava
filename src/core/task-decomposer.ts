import { Ollama } from 'ollama';
import logger from '../utils/logger.js';

/**
 * Task types that require different execution strategies
 */
export enum TaskIntent {
  READ = 'read',           // Read files, list directories
  WRITE = 'write',         // Create/modify files WITH content
  EXECUTE = 'execute',     // Run commands, execute code
  GENERATE = 'generate',   // Generate code/content
  COMPOUND = 'compound'    // Multi-step tasks (generate + write)
}

/**
 * Atomic operation in a task plan
 */
export interface TaskStep {
  action: 'generate' | 'write' | 'execute' | 'validate';
  description: string;
  executor: 'llm' | 'computer-use' | 'file-ops';
  params: {
    prompt?: string;
    command?: string;
    filePath?: string;
    content?: string;
    validationType?: 'file-exists' | 'file-not-empty' | 'syntax-valid';
  };
}

/**
 * Execution plan for a user request
 */
export interface TaskPlan {
  intent: TaskIntent;
  steps: TaskStep[];
  metadata: {
    requiresGeneration: boolean;
    requiresFileOps: boolean;
    requiresValidation: boolean;
  };
}

/**
 * Intelligent Task Decomposer
 *
 * The brain of the system that makes Kochava better than Claude Code:
 * 1. Analyzes user intent beyond simple pattern matching
 * 2. Decomposes complex tasks into atomic operations
 * 3. Determines optimal execution strategy
 * 4. Coordinates multiple executors (LLM, bash, file-ops)
 * 5. Validates each step before proceeding
 *
 * Example transformation:
 * "create fibonacci code in code.txt"
 * →
 * Plan:
 *   Step 1: Generate fibonacci code (LLM)
 *   Step 2: Write to file (file-ops)
 *   Step 3: Validate file exists and not empty
 *   Step 4: Report success
 */
export class TaskDecomposer {
  private ollama: Ollama;
  private modelName: string;

  constructor(modelName: string = 'phi3') {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.modelName = modelName;
  }

  /**
   * Analyze user request and create execution plan
   */
  async analyze(userRequest: string): Promise<TaskPlan> {
    const startTime = Date.now();

    try {
      // Quick pattern-based detection for common cases
      const quickIntent = this.quickIntentDetection(userRequest);
      if (quickIntent) {
        logger.debug('Quick intent detected', {
          intent: quickIntent,
          request: userRequest.substring(0, 100)
        });
        return this.createPlan(quickIntent, userRequest);
      }

      // Use AI for complex cases
      const intent = await this.detectIntent(userRequest);
      const plan = this.createPlan(intent, userRequest);

      logger.debug('Task decomposition complete', {
        intent,
        steps: plan.steps.length,
        latency: Date.now() - startTime
      });

      return plan;
    } catch (error: any) {
      logger.error('Task decomposition failed', { error: error.message });
      // Fallback to safe defaults
      return {
        intent: TaskIntent.EXECUTE,
        steps: [],
        metadata: {
          requiresGeneration: false,
          requiresFileOps: false,
          requiresValidation: false
        }
      };
    }
  }

  /**
   * Fast pattern-based intent detection for common cases
   */
  private quickIntentDetection(request: string): TaskIntent | null {
    const lower = request.toLowerCase();

    // READ operations - clear indicators
    if (/^(ls|cat|head|tail|grep|find|pwd|echo|which|show|list|read|view|display|what|count|how many)/i.test(request)) {
      return TaskIntent.READ;
    }

    // WRITE WITH CONTENT - these need code generation
    // Key phrases: "create X in file.ext", "write Y to X", "generate Y in X"
    // Match any "create/write/generate + CODE_KEYWORD + in/to/into + FILENAME"
    if (/create\s+.*(code|function|script|program|class).*\s+(in|to|into)\s+\w+\.\w+/i.test(lower) ||
        /create\s+.*\s+(with|containing|that has|including)/i.test(lower) ||
        /write\s+.*\s+(to|in|into)/i.test(lower) ||
        /generate\s+.*(code|function|script|program|class).*\s+(in|to|into)/i.test(lower)) {
      return TaskIntent.COMPOUND;
    }

    // WRITE WITHOUT CONTENT - simple file operations
    if (/^(touch|mkdir|rm|mv|cp|chmod|chown)/i.test(request)) {
      return TaskIntent.WRITE;
    }

    // GENERATE - pure code/content generation without file
    if (/^(generate|create|write|make)\s+(a\s+)?(function|class|code|script|program)/i.test(lower) &&
        !/\s(in|to|into)\s+/i.test(lower)) {
      return TaskIntent.GENERATE;
    }

    return null;
  }

  /**
   * AI-powered intent detection for ambiguous cases
   */
  private async detectIntent(request: string): Promise<TaskIntent> {
    const prompt = `Analyze this user request and classify the INTENT:

User Request: "${request}"

Intent Types:
1. READ - Just reading/viewing/listing (ls, cat, grep, find, show files, etc.)
2. WRITE - Simple file operations without generating content (touch, mkdir, mv, cp, rm, etc.)
3. GENERATE - Creating code/content but not saving to file
4. COMPOUND - Creating code/content AND saving to file (needs generation + write)
5. EXECUTE - Running commands, executing code, system operations

Examples:
"list files in downloads" → READ
"show me code.txt" → READ
"create empty file test.txt" → WRITE
"move file.txt to folder/" → WRITE
"generate a fibonacci function" → GENERATE
"create fibonacci code in code.txt" → COMPOUND
"write a sorting algorithm to sort.py" → COMPOUND
"run tests" → EXECUTE

Respond with ONLY ONE WORD: READ, WRITE, GENERATE, COMPOUND, or EXECUTE`;

    const response = await this.ollama.generate({
      model: this.modelName,
      prompt,
      stream: false,
      options: {
        temperature: 0.0,
        num_predict: 10
      }
    });

    const intent = response.response.trim().toUpperCase();

    // Map to enum, default to EXECUTE if unclear
    switch (intent) {
      case 'READ': return TaskIntent.READ;
      case 'WRITE': return TaskIntent.WRITE;
      case 'GENERATE': return TaskIntent.GENERATE;
      case 'COMPOUND': return TaskIntent.COMPOUND;
      case 'EXECUTE': return TaskIntent.EXECUTE;
      default:
        logger.warn('Unknown intent from AI', { intent, defaulting: 'EXECUTE' });
        return TaskIntent.EXECUTE;
    }
  }

  /**
   * Create execution plan based on intent
   */
  private createPlan(intent: TaskIntent, request: string): TaskPlan {
    const steps: TaskStep[] = [];

    switch (intent) {
      case TaskIntent.READ:
        // Simple read - direct bash execution
        steps.push({
          action: 'execute',
          description: 'Execute read operation',
          executor: 'computer-use',
          params: { command: request }
        });
        return {
          intent,
          steps,
          metadata: {
            requiresGeneration: false,
            requiresFileOps: false,
            requiresValidation: false
          }
        };

      case TaskIntent.WRITE:
        // Simple write - direct bash execution
        steps.push({
          action: 'execute',
          description: 'Execute write operation',
          executor: 'computer-use',
          params: { command: request }
        });
        steps.push({
          action: 'validate',
          description: 'Verify operation succeeded',
          executor: 'computer-use',
          params: { validationType: 'file-exists' }
        });
        return {
          intent,
          steps,
          metadata: {
            requiresGeneration: false,
            requiresFileOps: true,
            requiresValidation: true
          }
        };

      case TaskIntent.GENERATE:
        // Pure generation - use LLM
        steps.push({
          action: 'generate',
          description: 'Generate code/content',
          executor: 'llm',
          params: { prompt: request }
        });
        return {
          intent,
          steps,
          metadata: {
            requiresGeneration: true,
            requiresFileOps: false,
            requiresValidation: false
          }
        };

      case TaskIntent.COMPOUND:
        // Complex: generate + write
        // Extract file path from request
        // Try multiple patterns: "X in file.ext", "file.ext with X", "create file.ext with X"
        let fileMatch = request.match(/(?:in|to|into)\s+([^\s]+\.\w+)/i);
        if (!fileMatch) {
          // Try "create file.ext with X"
          fileMatch = request.match(/(?:create|make|write)\s+(?:a\s+)?(?:file\s+)?([^\s]+\.\w+)/i);
        }
        if (!fileMatch) {
          // Try "file.ext with X"
          fileMatch = request.match(/^([^\s]+\.\w+)\s+(?:with|containing)/i);
        }
        const filePath = fileMatch ? fileMatch[1] : 'output.txt';

        // Extract what to generate
        let generateMatch = request.match(/(?:create|write|generate)\s+(?:a\s+)?(?:file\s+)?(?:[^\s]+\.\w+\s+)?(?:with|containing)\s+(.+)/i);
        if (!generateMatch) {
          generateMatch = request.match(/(?:create|write|generate)\s+(.+?)\s+(?:in|to|into)/i);
        }
        const whatToGenerate = generateMatch ? generateMatch[1] : 'code';

        steps.push({
          action: 'generate',
          description: `Generate ${whatToGenerate}`,
          executor: 'llm',
          params: { prompt: `Create ${whatToGenerate}. Output ONLY the code, no explanations.` }
        });

        steps.push({
          action: 'write',
          description: `Write to ${filePath}`,
          executor: 'file-ops',
          params: {
            filePath,
            content: '{{GENERATED_CONTENT}}' // Placeholder, filled after generation
          }
        });

        steps.push({
          action: 'validate',
          description: `Verify ${filePath} was created`,
          executor: 'computer-use',
          params: {
            filePath,
            validationType: 'file-not-empty'
          }
        });

        return {
          intent,
          steps,
          metadata: {
            requiresGeneration: true,
            requiresFileOps: true,
            requiresValidation: true
          }
        };

      case TaskIntent.EXECUTE:
      default:
        // General execution
        steps.push({
          action: 'execute',
          description: 'Execute command',
          executor: 'computer-use',
          params: { command: request }
        });
        return {
          intent,
          steps,
          metadata: {
            requiresGeneration: false,
            requiresFileOps: false,
            requiresValidation: false
          }
        };
    }
  }

  /**
   * Check if model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.ollama.list();
      return response.models.some(m => m.name === this.modelName || m.name.startsWith(this.modelName));
    } catch {
      return false;
    }
  }
}
