import { ClaudeClient } from './client.js';
import { RoutingDecision } from '../types/index.js';
import logger from '../utils/logger.js';

export class ClaudeSupervisor {
  private client: ClaudeClient;
  private enabled: boolean;

  constructor(client: ClaudeClient, enabled: boolean = true) {
    this.client = client;
    this.enabled = enabled;
  }

  async shouldOverrideRouting(
    decision: RoutingDecision,
    userInput: string
  ): Promise<{ override: boolean; reason?: string }> {
    if (!this.enabled || decision.target === 'claude') {
      return { override: false };
    }

    if (decision.confidence > 0.85 && decision.complexity <= 3) {
      return { override: false };
    }

    try {
      const prompt = `You are a routing supervisor. A task has been classified as "${decision.taskType}" with complexity ${decision.complexity}/10 and will be routed to "${decision.target}".

User request: "${userInput}"

Should this be escalated to Claude (you) instead? Answer ONLY with:
YES [reason] or NO

Keep response under 50 words.`;

      const response = await this.client.generate(prompt);
      const content = response.content.trim();

      if (content.startsWith('YES')) {
        const reason = content.replace('YES', '').trim();
        logger.info('Claude supervisor overriding routing', {
          originalTarget: decision.target,
          reason
        });
        return { override: true, reason };
      }

      return { override: false };
    } catch (error) {
      logger.error('Supervisor check failed', { error });
      return { override: false };
    }
  }
}
