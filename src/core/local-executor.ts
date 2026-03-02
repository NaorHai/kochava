import { Ollama } from 'ollama';
import { ModelResponse, RouteTarget } from '../types/index.js';
import logger from '../utils/logger.js';

export class LocalExecutor {
  private ollama: Ollama;
  private modelMap: Map<RouteTarget, string>;

  constructor(
    codeModelName: string,
    compressModelName: string
  ) {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.modelMap = new Map([
      ['local_code', codeModelName],
      ['local_compress', compressModelName]
    ]);
  }

  async execute(
    target: RouteTarget,
    prompt: string,
    context?: string
  ): Promise<ModelResponse> {
    if (target === 'claude') {
      throw new Error('LocalExecutor cannot handle Claude routing');
    }

    const modelName = this.modelMap.get(target);
    if (!modelName) {
      throw new Error(`No model configured for target: ${target}`);
    }

    const startTime = Date.now();

    try {
      const fullPrompt = context
        ? `Context:\n${context}\n\nTask:\n${prompt}`
        : prompt;

      const response = await this.ollama.generate({
        model: modelName,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: target === 'local_code' ? 0.2 : 0.3,
          num_predict: target === 'local_code' ? 4096 : 2048,
        }
      });

      const latency = Date.now() - startTime;

      logger.info('Local model executed', {
        model: modelName,
        target,
        latency,
        responseLength: response.response.length
      });

      return {
        content: response.response,
        model: modelName,
        tokens: response.eval_count || 0,
        latency
      };
    } catch (error) {
      logger.error('Local execution failed', { error, model: modelName });
      throw error;
    }
  }

  async isModelAvailable(modelName: string): Promise<boolean> {
    try {
      const response = await this.ollama.list();
      return response.models.some(m => m.name === modelName);
    } catch (error) {
      logger.error('Failed to check model availability', { error, modelName });
      return false;
    }
  }
}
