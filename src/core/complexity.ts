import { ComplexityScore, TaskContext, TaskType } from '../types/index.js';
import logger from '../utils/logger.js';

export class ComplexityScorer {

  score(taskType: TaskType, context: TaskContext): ComplexityScore {
    const factors = {
      linesOfCode: this.scoreLinesOfCode(context.codeContext),
      filesInvolved: this.scoreFilesInvolved(context.fileCount),
      dependencies: this.scoreDependencies(context.input),
      reasoning: this.scoreReasoningDepth(taskType, context.input)
    };

    const totalScore = Math.min(
      factors.linesOfCode * 0.2 +
      factors.filesInvolved * 0.3 +
      factors.dependencies * 0.2 +
      factors.reasoning * 0.3,
      10
    );

    logger.debug('Complexity scored', {
      taskType,
      score: totalScore,
      factors
    });

    return {
      score: Math.round(totalScore * 10) / 10,
      factors
    };
  }

  private scoreLinesOfCode(codeContext?: string): number {
    if (!codeContext) return 1;

    const lines = codeContext.split('\n').length;

    if (lines < 10) return 1;
    if (lines < 50) return 2;
    if (lines < 100) return 4;
    if (lines < 300) return 6;
    return 8;
  }

  private scoreFilesInvolved(fileCount?: number): number {
    if (!fileCount || fileCount <= 1) return 1;
    if (fileCount === 2) return 3;
    if (fileCount <= 4) return 5;
    if (fileCount <= 8) return 7;
    return 9;
  }

  private scoreDependencies(input: string): number {
    const indicators = [
      'import',
      'require',
      'dependency',
      'package',
      'module',
      'integrate',
      'api',
      'service'
    ];

    const matches = indicators.filter(ind =>
      input.toLowerCase().includes(ind)
    ).length;

    return Math.min(matches * 1.5, 8);
  }

  private scoreReasoningDepth(taskType: TaskType, input: string): number {
    const baseScores: Record<TaskType, number> = {
      trivial_edit: 1,
      formatting: 1,
      explanation: 3,
      refactor_small: 4,
      deep_debug: 7,
      architecture: 9,
      multi_file_reasoning: 8,
      bash_operation: 1,
      file_operation: 1
    };

    const complexityKeywords = [
      'why',
      'how does',
      'explain',
      'design',
      'optimize',
      'performance',
      'scale',
      'architecture'
    ];

    const keywordBonus = complexityKeywords.filter(kw =>
      input.toLowerCase().includes(kw)
    ).length * 0.5;

    return Math.min(baseScores[taskType] + keywordBonus, 10);
  }
}
