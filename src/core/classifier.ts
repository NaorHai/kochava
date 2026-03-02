import { Ollama } from 'ollama';
import { ClassificationResult, TaskType, RoutingConfig } from '../types/index.js';
import logger from '../utils/logger.js';
import { estimateTokens } from '../utils/token-counter.js';

export class TaskClassifier {
  private ollama: Ollama;
  private modelName: string;
  private config: RoutingConfig;

  constructor(modelName: string, config: RoutingConfig) {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.modelName = modelName;
    this.config = config;
  }

  async classify(input: string): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildClassificationPrompt(input);

      const response = await this.ollama.generate({
        model: this.modelName,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 256,
        }
      });

      const result = this.parseClassificationResponse(response.response, input);

      logger.info('Task classified', {
        taskType: result.taskType,
        confidence: result.confidence,
        latency: Date.now() - startTime,
        model: this.modelName
      });

      return result;
    } catch (error) {
      logger.error('Classification failed', { error, input: input.slice(0, 100) });
      return this.fallbackClassification(input);
    }
  }

  private buildClassificationPrompt(input: string): string {
    const taskDescriptions = Object.entries(this.config.taskTypes)
      .map(([type, def]) => `- ${type}: ${def.description}`)
      .join('\n');

    return `You are a task classifier for a code assistant. Classify the following user request into ONE of these categories:

${taskDescriptions}

User request: "${input}"

Respond in this exact format:
TASK_TYPE: [one of the types above]
CONFIDENCE: [0.0 to 1.0]
REASONING: [brief explanation]`;
  }

  private parseClassificationResponse(response: string, input: string): ClassificationResult {
    const taskTypeMatch = response.match(/TASK_TYPE:\s*(\w+)/i);
    const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasoningMatch = response.match(/REASONING:\s*(.+)/is);

    let taskType = (taskTypeMatch?.[1] || 'explanation') as TaskType;

    if (!this.config.taskTypes[taskType]) {
      taskType = this.inferFromKeywords(input);
    }

    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
    const reasoning = reasoningMatch?.[1]?.trim() || 'Classified based on pattern matching';

    return {
      taskType,
      confidence: Math.min(Math.max(confidence, 0), 1),
      reasoning
    };
  }

  private inferFromKeywords(input: string): TaskType {
    const lowerInput = input.toLowerCase();

    for (const [taskType, def] of Object.entries(this.config.taskTypes)) {
      for (const keyword of def.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          return taskType as TaskType;
        }
      }
    }

    return 'explanation';
  }

  private fallbackClassification(input: string): ClassificationResult {
    const taskType = this.inferFromKeywords(input);

    return {
      taskType,
      confidence: 0.4,
      reasoning: 'Fallback classification due to model error'
    };
  }
}
