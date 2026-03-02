import { OptimizedContext, RoutingConfig } from '../types/index.js';
import { estimateTokens } from '../utils/token-counter.js';
import logger from '../utils/logger.js';

export class ContextOptimizer {
  private config: RoutingConfig;

  constructor(config: RoutingConfig) {
    this.config = config;
  }

  optimize(context: string): OptimizedContext {
    const originalTokens = estimateTokens(context);
    let optimized = context;
    const operations: string[] = [];

    if (this.config.contextOptimization.stripComments) {
      optimized = this.stripComments(optimized);
      operations.push('stripped_comments');
    }

    if (this.config.contextOptimization.removeBlankLines) {
      optimized = this.removeBlankLines(optimized);
      operations.push('removed_blank_lines');
    }

    if (this.config.contextOptimization.deduplicateImports) {
      optimized = this.deduplicateImports(optimized);
      operations.push('deduplicated_imports');
    }

    const maxTokens = this.config.contextOptimization.maxContextTokens;
    if (estimateTokens(optimized) > maxTokens) {
      optimized = this.truncateToTokenLimit(optimized, maxTokens);
      operations.push('truncated_to_limit');
    }

    const optimizedTokens = estimateTokens(optimized);
    const tokensSaved = originalTokens - optimizedTokens;

    logger.debug('Context optimized', {
      originalTokens,
      optimizedTokens,
      tokensSaved,
      operations
    });

    return {
      original: context,
      optimized,
      tokensSaved,
      operations
    };
  }

  private stripComments(code: string): string {
    let result = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/#.*/g, '');

    return result;
  }

  private removeBlankLines(text: string): string {
    return text
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');
  }

  private deduplicateImports(code: string): string {
    const lines = code.split('\n');
    const imports = new Set<string>();
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('from ') ||
        trimmed.startsWith('require(')
      ) {
        if (!imports.has(trimmed)) {
          imports.add(trimmed);
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = estimateTokens(text);

    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio * 0.95);

    return text.slice(0, targetLength) + '\n\n[Context truncated to fit token limit]';
  }
}
