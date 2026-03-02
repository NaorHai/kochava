import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';
import logger from '../utils/logger.js';
import { UsageMetrics } from '../types/index.js';

interface PersistedMetrics extends UsageMetrics {
  lastUpdated: number;
}

/**
 * Metrics Manager - Persists usage statistics across sessions
 *
 * Tracks cumulative metrics:
 * - Total requests (local + Claude)
 * - Tokens used and saved
 * - Average latency
 * - Cost savings
 *
 * Data persisted to: ~/.kochava/metrics.json
 */
export class MetricsManager {
  private metricsFile: string;
  private metrics: PersistedMetrics;

  constructor() {
    this.metricsFile = path.join(homedir(), '.kochava', 'metrics.json');

    // Initialize with defaults
    this.metrics = {
      totalRequests: 0,
      localRequests: 0,
      claudeRequests: 0,
      tokensSaved: 0,
      claudeTokensUsed: 0,
      avgLatency: 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * Load metrics from disk
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf-8');
      const loaded = JSON.parse(data) as PersistedMetrics;

      this.metrics = {
        ...loaded,
        lastUpdated: loaded.lastUpdated || Date.now()
      };

      logger.debug('Metrics loaded', {
        totalRequests: this.metrics.totalRequests,
        localRatio: this.metrics.localRequests / (this.metrics.totalRequests || 1)
      });
    } catch (error) {
      // File doesn't exist or is invalid - use defaults
      logger.debug('No metrics file found, starting fresh');
    }
  }

  /**
   * Save metrics to disk
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.metricsFile), { recursive: true });

      this.metrics.lastUpdated = Date.now();

      await fs.writeFile(
        this.metricsFile,
        JSON.stringify(this.metrics, null, 2),
        'utf-8'
      );

      logger.debug('Metrics saved', {
        totalRequests: this.metrics.totalRequests,
        file: this.metricsFile
      });
    } catch (error: any) {
      logger.error('Failed to save metrics', { error: error.message });
    }
  }

  /**
   * Update metrics with new request data
   */
  async recordRequest(
    isLocal: boolean,
    tokens: number,
    latency: number,
    tokensSaved: number = 0
  ): Promise<void> {
    this.metrics.totalRequests++;

    if (isLocal) {
      this.metrics.localRequests++;
      this.metrics.tokensSaved += tokensSaved;
    } else {
      this.metrics.claudeRequests++;
      this.metrics.claudeTokensUsed += tokens;
    }

    // Update running average latency
    const totalLatency = this.metrics.avgLatency * (this.metrics.totalRequests - 1) + latency;
    this.metrics.avgLatency = totalLatency / this.metrics.totalRequests;

    // Auto-save after each request
    await this.save();
  }

  /**
   * Get current metrics
   */
  getMetrics(): UsageMetrics {
    return {
      totalRequests: this.metrics.totalRequests,
      localRequests: this.metrics.localRequests,
      claudeRequests: this.metrics.claudeRequests,
      tokensSaved: this.metrics.tokensSaved,
      claudeTokensUsed: this.metrics.claudeTokensUsed,
      avgLatency: this.metrics.avgLatency
    };
  }

  /**
   * Get detailed stats for display
   */
  getStats(): {
    totalRequests: number;
    localRequests: number;
    localRatio: number;
    claudeRequests: number;
    claudeRatio: number;
    tokensSaved: number;
    claudeTokensUsed: number;
    avgLatency: number;
    costSavings: number;
    lastUpdated: Date;
  } {
    const total = this.metrics.totalRequests || 1;
    const localRatio = this.metrics.localRequests / total;
    const claudeRatio = this.metrics.claudeRequests / total;

    // Estimate cost savings (Claude pricing: ~$3 per 1M input tokens, ~$15 per 1M output tokens)
    // Average ~$9 per 1M tokens
    const costSavings = (this.metrics.tokensSaved / 1_000_000) * 9;

    return {
      totalRequests: this.metrics.totalRequests,
      localRequests: this.metrics.localRequests,
      localRatio,
      claudeRequests: this.metrics.claudeRequests,
      claudeRatio,
      tokensSaved: this.metrics.tokensSaved,
      claudeTokensUsed: this.metrics.claudeTokensUsed,
      avgLatency: Math.round(this.metrics.avgLatency),
      costSavings: Math.round(costSavings * 100) / 100,
      lastUpdated: new Date(this.metrics.lastUpdated)
    };
  }

  /**
   * Reset all metrics (admin command)
   */
  async reset(): Promise<void> {
    this.metrics = {
      totalRequests: 0,
      localRequests: 0,
      claudeRequests: 0,
      tokensSaved: 0,
      claudeTokensUsed: 0,
      avgLatency: 0,
      lastUpdated: Date.now()
    };

    await this.save();
    logger.info('Metrics reset');
  }
}
