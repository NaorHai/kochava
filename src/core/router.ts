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

    // Smart routing: Ollama (local) or Claude (cloud)
    const shouldEscalate = this.shouldEscalateToCloud(
      complexityScore.score,
      classification.confidence,
      taskDef.maxComplexity
    );

    if (shouldEscalate && target !== 'claude') {
      logger.debug('Escalating to Claude', {
        originalTarget: target,
        complexity: complexityScore.score,
        confidence: classification.confidence
      });
      target = 'claude';
    }

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
    if (context.fileCount && context.fileCount > 2) return 6;
    return 3;
  }

  private inferTaskType(target: RouteTarget): 'trivial_edit' | 'explanation' | 'architecture' {
    const mapping: Record<RouteTarget, 'trivial_edit' | 'explanation' | 'architecture'> = {
      'claude': 'architecture',
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

}
