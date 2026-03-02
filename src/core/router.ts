import { TaskClassifier } from './classifier.js';
import { ComplexityScorer } from './complexity.js';
import { SkillClassifier } from './skill-classifier.js';
import { FastRouter } from './fast-router.js';
import { RoutingDecision, TaskContext, RoutingConfig, ModelConfig, RouteTarget } from '../types/index.js';
import logger from '../utils/logger.js';

export class TaskRouter {
  private classifier: TaskClassifier;
  private complexityScorer: ComplexityScorer;
  private skillClassifier: SkillClassifier;
  private fastRouter: FastRouter;
  private routingConfig: RoutingConfig;

  constructor(routingConfig: RoutingConfig, modelConfig: ModelConfig) {
    this.classifier = new TaskClassifier(
      modelConfig.models.classifier.name,
      routingConfig
    );
    this.complexityScorer = new ComplexityScorer();
    this.skillClassifier = new SkillClassifier();
    this.fastRouter = new FastRouter();
    this.routingConfig = routingConfig;
  }

  async route(context: TaskContext): Promise<RoutingDecision> {
    const startTime = Date.now();

    // First check if this is a skill invocation
    const skillClassification = this.skillClassifier.classify(context.input);

    if (skillClassification.isSkill) {
      logger.debug('Routing skill to local_general', {
        skill: skillClassification.skillName,
        type: skillClassification.skillType
      });

      return {
        target: 'local_general',
        taskType: skillClassification.skillType === 'simple' ? 'trivial_edit' : 'refactor_small',
        complexity: skillClassification.skillType === 'simple' ? 2 : 6,
        confidence: skillClassification.confidence,
        reasoning: `Skill '${skillClassification.skillName}' invocation`,
        shouldEscalate: false
      };
    }

    // Try fast-path heuristic routing first
    const fastTarget = this.fastRouter.tryFastRoute(context);

    if (fastTarget) {
      // Fast route succeeded - skip classifier
      const quickComplexity = this.estimateComplexity(fastTarget, context);

      return {
        target: fastTarget,
        taskType: this.inferTaskType(fastTarget),
        complexity: quickComplexity,
        confidence: 0.85, // High confidence from heuristics
        reasoning: `Fast-path routing based on heuristics`,
        shouldEscalate: false
      };
    }

    // Ambiguous case - use classifier
    logger.debug('Using classifier for ambiguous case');
    const classification = await this.classifier.classify(context.input);

    const complexityScore = this.complexityScorer.score(
      classification.taskType,
      context
    );

    const taskDef = this.routingConfig.taskTypes[classification.taskType];
    let target = taskDef.route;

    // 3-tier smart routing: Ollama (1-3) → Cursor (4-7) → Claude (8-10)
    const originalTarget = target;
    target = this.determineSmartRoute(
      complexityScore.score,
      classification.confidence,
      taskDef.maxComplexity,
      target
    );

    const shouldEscalate = originalTarget !== target;

    const decision: RoutingDecision = {
      target,
      taskType: classification.taskType,
      complexity: complexityScore.score,
      confidence: classification.confidence,
      reasoning: `${classification.reasoning}. Complexity: ${complexityScore.score}/10`,
      shouldEscalate
    };

    logger.debug('Routing decision made', {
      ...decision,
      latency: Date.now() - startTime
    });

    return decision;
  }

  private estimateComplexity(target: RouteTarget, context: TaskContext): number {
    if (target === 'claude') return 8;
    if (target === 'cursor') return 5;
    if (context.fileCount && context.fileCount > 2) return 6;
    return 3;
  }

  private inferTaskType(target: RouteTarget): 'trivial_edit' | 'explanation' | 'architecture' {
    const mapping: Record<RouteTarget, 'trivial_edit' | 'explanation' | 'architecture'> = {
      'claude': 'architecture',
      'cursor': 'explanation',
      'local_code': 'trivial_edit',
      'local_general': 'explanation',
      'local_compress': 'explanation'
    };
    return mapping[target] || 'explanation';
  }

  private shouldEscalateToCloud(
    complexity: number,
    confidence: number,
    maxComplexity: number
  ): boolean {
    if (!this.routingConfig.escalation.enabled) {
      return false;
    }

    if (complexity > maxComplexity) {
      return true;
    }

    if (complexity >= this.routingConfig.complexityThresholds.claude) {
      return true;
    }

    if (
      confidence < this.routingConfig.escalation.confidenceThreshold &&
      complexity >= this.routingConfig.complexityThresholds.local
    ) {
      return true;
    }

    return false;
  }

  /**
   * 3-tier smart routing based on complexity
   *
   * Tier 1 (Ollama): Complexity 1-3 - Free local models
   * Tier 2 (Cursor): Complexity 4-7 - Licensed cloud models (already paid for)
   * Tier 3 (Claude): Complexity 8-10 - Premium Claude API (pay-per-use)
   *
   * Benefits:
   * - Saves money by using Cursor instead of Claude for medium complexity
   * - Leverages existing Cursor license
   * - Maintains quality for complex tasks with Claude
   */
  private determineSmartRoute(
    complexity: number,
    confidence: number,
    maxComplexity: number,
    defaultTarget: RouteTarget
  ): RouteTarget {
    // Disable escalation if config says so
    if (!this.routingConfig.escalation.enabled) {
      return defaultTarget;
    }

    // Complexity 8-10: Route to Claude (most complex)
    if (complexity >= 8 || complexity > maxComplexity) {
      logger.debug('Routing to Claude (high complexity)', { complexity });
      return 'claude';
    }

    // Complexity 4-7: Route to Cursor (medium complexity)
    if (complexity >= 4) {
      logger.debug('Routing to Cursor (medium complexity)', { complexity });
      return 'cursor';
    }

    // Complexity 1-3: Keep local
    // Check if we need to escalate due to low confidence
    if (
      confidence < this.routingConfig.escalation.confidenceThreshold &&
      complexity >= 3
    ) {
      logger.debug('Escalating to Cursor (low confidence)', { complexity, confidence });
      return 'cursor';
    }

    // Stay local (Ollama)
    return defaultTarget.startsWith('local') ? defaultTarget : 'local_general';
  }
}
