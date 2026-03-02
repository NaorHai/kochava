import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger.js';

export interface CursorResponse {
  content: string;
  tokens: number;
  model: string;
}

/**
 * Cursor Client for smart routing integration
 *
 * Cursor provides access to multiple models (GPT-4, Claude, etc.) through their licensed API.
 * This client acts as a middle tier between free Ollama and paid Claude API.
 *
 * Routing hierarchy:
 * - Ollama (free) → Cursor (licensed) → Claude (paid)
 */
export class CursorClient {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private client?: Anthropic;

  constructor(apiKey?: string, baseURL?: string) {
    // Cursor API configuration
    // For now, use environment variables or fall back to Claude endpoint
    this.apiKey = apiKey || process.env.CURSOR_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    this.baseURL = baseURL || process.env.CURSOR_BASE_URL || 'https://api.anthropic.com';
    this.defaultModel = process.env.CURSOR_MODEL || 'claude-3-5-sonnet-20241022';

    if (this.apiKey) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
        baseURL: this.baseURL
      });
      logger.debug('Cursor client initialized', {
        baseURL: this.baseURL,
        model: this.defaultModel
      });
    } else {
      logger.warn('Cursor API key not found. Cursor routing will be disabled.');
    }
  }

  /**
   * Check if Cursor is available (has valid API key)
   */
  isAvailable(): boolean {
    return !!this.client && !!this.apiKey;
  }

  /**
   * Generate response using Cursor's model
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    maxTokens: number = 2048
  ): Promise<CursorResponse> {
    if (!this.client) {
      throw new Error('Cursor client not initialized. Set CURSOR_API_KEY environment variable.');
    }

    const startTime = Date.now();

    try {
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: maxTokens,
        temperature: 0.3,
        system: systemPrompt,
        messages
      });

      const latency = Date.now() - startTime;
      const content = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const totalTokens = inputTokens + outputTokens;

      logger.debug('Cursor response received', {
        model: this.defaultModel,
        tokens: totalTokens,
        latency
      });

      return {
        content,
        tokens: totalTokens,
        model: `cursor:${this.defaultModel}`
      };
    } catch (error: any) {
      logger.error('Cursor generation failed', {
        error: error.message,
        model: this.defaultModel
      });
      throw error;
    }
  }

  /**
   * Get the model name being used
   */
  getModelName(): string {
    return this.defaultModel;
  }

  /**
   * Check if a specific model is available through Cursor
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    // Cursor supports Claude models by default
    const supportedModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];

    return supportedModels.includes(modelName);
  }
}
