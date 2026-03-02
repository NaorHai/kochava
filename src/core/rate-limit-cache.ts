import logger from '../utils/logger.js';
import { RouteTarget } from '../types/index.js';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

interface RateLimitEntry {
  target: RouteTarget;
  blockedAt: number;
  expiresAt: number;
  reason?: string;
}

/**
 * Rate Limit Cache
 *
 * Caches which models have exceeded their rate limits to avoid repeated failed API calls.
 * When a paid model (Cursor, Claude) hits rate limit, we cache this status for a
 * configurable duration (default 4 hours) and automatically route to alternatives.
 *
 * Benefits:
 * - Lower latency (no repeated failed API calls)
 * - Better UX (immediate fallback instead of waiting for timeout)
 * - Cost savings (avoid unnecessary API calls)
 */
export class RateLimitCache {
  private cache: Map<RouteTarget, RateLimitEntry> = new Map();
  private cacheDuration: number;
  private cacheFile: string;

  constructor(cacheDurationHours: number = 4) {
    // Default 4 hours, configurable via env
    this.cacheDuration = cacheDurationHours * 60 * 60 * 1000;
    this.cacheFile = path.join(homedir(), '.kochava', 'rate-limits.json');

    logger.debug('Rate limit cache initialized', {
      durationHours: cacheDurationHours,
      cacheFile: this.cacheFile
    });
  }

  /**
   * Load cache from disk (persists across sessions)
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf-8');
      const entries: RateLimitEntry[] = JSON.parse(data);

      const now = Date.now();
      for (const entry of entries) {
        // Only load non-expired entries
        if (entry.expiresAt > now) {
          this.cache.set(entry.target, entry);
        }
      }

      logger.debug('Rate limit cache loaded', {
        entries: this.cache.size,
        expired: entries.length - this.cache.size
      });
    } catch (error) {
      // Cache file doesn't exist or is invalid - start fresh
      logger.debug('No rate limit cache found, starting fresh');
    }
  }

  /**
   * Save cache to disk
   */
  private async save(): Promise<void> {
    try {
      const entries = Array.from(this.cache.values());

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });

      await fs.writeFile(
        this.cacheFile,
        JSON.stringify(entries, null, 2),
        'utf-8'
      );

      logger.debug('Rate limit cache saved', { entries: entries.length });
    } catch (error: any) {
      logger.error('Failed to save rate limit cache', { error: error.message });
    }
  }

  /**
   * Mark a model as rate limited
   */
  async markRateLimited(target: RouteTarget, reason?: string): Promise<void> {
    const now = Date.now();
    const expiresAt = now + this.cacheDuration;

    const entry: RateLimitEntry = {
      target,
      blockedAt: now,
      expiresAt,
      reason
    };

    this.cache.set(target, entry);
    await this.save();

    const hoursRemaining = Math.ceil((expiresAt - now) / (60 * 60 * 1000));

    logger.warn('Model marked as rate limited', {
      target,
      reason,
      expiresInHours: hoursRemaining
    });
  }

  /**
   * Check if a model is currently rate limited
   */
  isRateLimited(target: RouteTarget): boolean {
    const entry = this.cache.get(target);

    if (!entry) {
      return false;
    }

    const now = Date.now();

    // Check if expired
    if (entry.expiresAt <= now) {
      this.cache.delete(target);
      // Don't await - async cleanup
      this.save().catch(err => logger.error('Failed to save cache after cleanup', { err }));
      return false;
    }

    const minutesRemaining = Math.ceil((entry.expiresAt - now) / (60 * 1000));

    logger.debug('Model is rate limited', {
      target,
      minutesRemaining,
      reason: entry.reason
    });

    return true;
  }

  /**
   * Get time remaining until rate limit expires
   */
  getTimeRemaining(target: RouteTarget): number {
    const entry = this.cache.get(target);

    if (!entry) {
      return 0;
    }

    const now = Date.now();
    const remaining = entry.expiresAt - now;

    return Math.max(0, remaining);
  }

  /**
   * Manually clear rate limit for a model (admin override)
   */
  async clearRateLimit(target: RouteTarget): Promise<void> {
    if (this.cache.has(target)) {
      this.cache.delete(target);
      await this.save();

      logger.info('Rate limit manually cleared', { target });
    }
  }

  /**
   * Clear all rate limits (admin override)
   */
  async clearAll(): Promise<void> {
    this.cache.clear();
    await this.save();

    logger.info('All rate limits cleared');
  }

  /**
   * Get all currently rate limited models
   */
  getRateLimitedModels(): Array<{ target: RouteTarget; minutesRemaining: number; reason?: string }> {
    const now = Date.now();
    const result: Array<{ target: RouteTarget; minutesRemaining: number; reason?: string }> = [];

    for (const [target, entry] of this.cache.entries()) {
      if (entry.expiresAt > now) {
        const minutesRemaining = Math.ceil((entry.expiresAt - now) / (60 * 1000));
        result.push({
          target,
          minutesRemaining,
          reason: entry.reason
        });
      }
    }

    return result;
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { totalBlocked: number; targets: string[] } {
    return {
      totalBlocked: this.cache.size,
      targets: Array.from(this.cache.keys())
    };
  }
}
