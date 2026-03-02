import Anthropic from '@anthropic-ai/sdk';
import { ModelResponse, ConversationTurn } from '../types/index.js';
import logger, { tokenLogger } from '../utils/logger.js';
import { estimateTokens } from '../utils/token-counter.js';

export type ClaudeErrorType =
  | 'credits_exhausted'
  | 'rate_limit'
  | 'invalid_api_key'
  | 'network_error'
  | 'budget_exceeded'
  | 'unknown';

export class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public errorType: ClaudeErrorType,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
  }
}

export class ClaudeBudgetExceededError extends Error {
  constructor(
    message: string,
    public tokensUsed: number,
    public tokenBudget: number
  ) {
    super(message);
    this.name = 'ClaudeBudgetExceededError';
  }
}

export class ClaudeClient {
  private client: Anthropic;
  private tokenBudget: number;
  private tokensUsed: number = 0;

  constructor(apiKey: string, tokenBudget: number = 8000, baseURL?: string) {
    const config: any = { apiKey };

    // Support AWS Bedrock via custom baseURL
    if (baseURL) {
      config.baseURL = baseURL;
      logger.info('Using custom Bedrock endpoint', { baseURL });
    }

    this.client = new Anthropic(config);
    this.tokenBudget = tokenBudget;
  }

  async generate(
    prompt: string,
    context?: string,
    history?: ConversationTurn[]
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const messages = this.buildMessages(prompt, context, history);

      const estimatedInputTokens = messages.reduce(
        (sum, msg) => sum + estimateTokens(msg.content as string),
        0
      );

      if (this.tokensUsed + estimatedInputTokens > this.tokenBudget) {
        logger.warn('Token budget exceeded', {
          tokensUsed: this.tokensUsed,
          budget: this.tokenBudget,
          estimated: estimatedInputTokens
        });

        throw new ClaudeBudgetExceededError(
          `Token budget exceeded: ${this.tokensUsed}/${this.tokenBudget}`,
          this.tokensUsed,
          this.tokenBudget
        );
      }

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: Math.min(4096, this.tokenBudget - this.tokensUsed),
        messages,
      });

      const content = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const totalTokens = inputTokens + outputTokens;

      this.tokensUsed += totalTokens;

      tokenLogger.info('Claude API call', {
        inputTokens,
        outputTokens,
        totalTokens,
        totalUsed: this.tokensUsed,
        budget: this.tokenBudget,
        latency: Date.now() - startTime
      });

      return {
        content,
        model: 'claude-sonnet-4',
        tokens: totalTokens,
        latency: Date.now() - startTime
      };
    } catch (error: any) {
      const errorType = this.classifyError(error);

      logger.error('Claude API call failed', {
        error: error.message,
        type: errorType,
        tokensUsed: this.tokensUsed,
        budget: this.tokenBudget
      });

      throw new ClaudeAPIError(error.message, errorType, error);
    }
  }

  private classifyError(error: any): ClaudeErrorType {
    const message = error.message?.toLowerCase() || '';

    if (error instanceof ClaudeBudgetExceededError) {
      return 'budget_exceeded';
    }

    if (message.includes('credit') || message.includes('quota') || error.status === 429) {
      return 'credits_exhausted';
    }

    if (message.includes('rate limit')) {
      return 'rate_limit';
    }

    if (message.includes('invalid') || message.includes('authentication') || error.status === 401) {
      return 'invalid_api_key';
    }

    if (message.includes('network') || message.includes('timeout') || error.code === 'ECONNREFUSED') {
      return 'network_error';
    }

    return 'unknown';
  }

  private buildMessages(
    prompt: string,
    context?: string,
    history?: ConversationTurn[]
  ): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    if (history && history.length > 0) {
      for (const turn of history) {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.content
        });
      }
    }

    const userContent = context
      ? `Context:\n${context}\n\nRequest:\n${prompt}`
      : prompt;

    messages.push({
      role: 'user',
      content: userContent
    });

    return messages;
  }

  getTokensUsed(): number {
    return this.tokensUsed;
  }

  getTokenBudget(): number {
    return this.tokenBudget;
  }

  resetTokenCounter(): void {
    this.tokensUsed = 0;
  }
}
