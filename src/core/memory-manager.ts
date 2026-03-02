import { ConversationTurn, RoutingConfig } from '../types/index.js';
import { estimateTokens } from '../utils/token-counter.js';
import { Ollama } from 'ollama';
import logger from '../utils/logger.js';

export class MemoryManager {
  private history: ConversationTurn[] = [];
  private config: RoutingConfig;
  private ollama: Ollama;
  private summaryModel: string;

  constructor(config: RoutingConfig, summaryModel: string) {
    this.config = config;
    this.summaryModel = summaryModel;
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
  }

  addTurn(role: 'user' | 'assistant', content: string): void {
    const turn: ConversationTurn = {
      role,
      content,
      tokens: estimateTokens(content),
      timestamp: Date.now()
    };

    this.history.push(turn);

    if (this.shouldSummarize()) {
      this.summarizeHistory().catch(error => {
        logger.error('Failed to summarize history', { error });
      });
    }
  }

  getHistory(): ConversationTurn[] {
    return [...this.history];
  }

  getRecentHistory(maxTokens: number): ConversationTurn[] {
    const recent: ConversationTurn[] = [];
    let tokenCount = 0;

    for (let i = this.history.length - 1; i >= 0; i--) {
      const turn = this.history[i];
      const turnTokens = turn.tokens || estimateTokens(turn.content);

      if (tokenCount + turnTokens > maxTokens) {
        break;
      }

      recent.unshift(turn);
      tokenCount += turnTokens;
    }

    return recent;
  }

  clear(): void {
    this.history = [];
  }

  private shouldSummarize(): boolean {
    if (!this.config.memoryManagement.enableRollingSummary) {
      return false;
    }

    if (this.history.length < this.config.memoryManagement.maxTurnsBeforeSummary) {
      return false;
    }

    const totalTokens = this.history.reduce(
      (sum, turn) => sum + (turn.tokens || estimateTokens(turn.content)),
      0
    );

    return totalTokens > this.config.memoryManagement.maxHistoryTokens;
  }

  private async summarizeHistory(): Promise<void> {
    if (this.history.length < 3) {
      return;
    }

    try {
      const conversationText = this.history
        .map(turn => `${turn.role}: ${turn.content}`)
        .join('\n\n');

      const prompt = `Summarize this conversation history concisely, preserving key context and decisions. Keep it under 300 words:

${conversationText}

Summary:`;

      const response = await this.ollama.generate({
        model: this.summaryModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 512
        }
      });

      const summary = response.response.trim();

      this.history = [
        {
          role: 'assistant',
          content: `[Summary of previous conversation]\n${summary}`,
          tokens: estimateTokens(summary),
          timestamp: Date.now()
        },
        ...this.history.slice(-2)
      ];

      logger.info('Conversation history summarized', {
        originalTurns: this.history.length,
        newTurns: 3
      });
    } catch (error) {
      logger.error('Summarization failed', { error });
    }
  }
}
