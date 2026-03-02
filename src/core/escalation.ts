import { RoutingDecision, ModelResponse } from '../types/index.js';
import { escalationLogger } from '../utils/logger.js';

export class EscalationManager {
  private escalationHistory: EscalationEvent[] = [];

  logEscalation(
    decision: RoutingDecision,
    originalTarget: string,
    reason: string
  ): void {
    const event: EscalationEvent = {
      timestamp: Date.now(),
      from: originalTarget,
      to: decision.target,
      reason,
      taskType: decision.taskType,
      complexity: decision.complexity,
      confidence: decision.confidence
    };

    this.escalationHistory.push(event);

    escalationLogger.info('Task escalated', event);
  }

  getEscalationStats(): EscalationStats {
    const total = this.escalationHistory.length;

    if (total === 0) {
      return {
        totalEscalations: 0,
        byReason: {},
        byTaskType: {},
        avgComplexity: 0
      };
    }

    const byReason: Record<string, number> = {};
    const byTaskType: Record<string, number> = {};
    let complexitySum = 0;

    for (const event of this.escalationHistory) {
      byReason[event.reason] = (byReason[event.reason] || 0) + 1;
      byTaskType[event.taskType] = (byTaskType[event.taskType] || 0) + 1;
      complexitySum += event.complexity;
    }

    return {
      totalEscalations: total,
      byReason,
      byTaskType,
      avgComplexity: complexitySum / total
    };
  }

  shouldRetryLocally(
    response: ModelResponse,
    decision: RoutingDecision
  ): boolean {
    if (response.content.includes('[ERROR]')) {
      return false;
    }

    if (response.latency > 60000) {
      return false;
    }

    return decision.complexity <= 3 && decision.confidence > 0.7;
  }
}

interface EscalationEvent {
  timestamp: number;
  from: string;
  to: string;
  reason: string;
  taskType: string;
  complexity: number;
  confidence: number;
}

interface EscalationStats {
  totalEscalations: number;
  byReason: Record<string, number>;
  byTaskType: Record<string, number>;
  avgComplexity: number;
}
