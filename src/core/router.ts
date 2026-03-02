import { TaskClassifier } from './classifier.js';
import { ComplexityScorer } from './complexity.js';
import { SkillClassifier } from './skill-classifier.js';
import { RoutingDecision, TaskContext, RoutingConfig, ModelConfig } from '../types/index.js';
import logger from '../utils/logger.js';

export class TaskRouter {
  private classifier: TaskClassifier;
  private complexityScorer: ComplexityScorer;
  private skillClassifier: SkillClassifier;
  private routingConfig: RoutingConfig;

  constructor(routingConfig: RoutingConfig, modelConfig: ModelConfig) {
    this.classifier = new TaskClassifier(
      modelConfig.models.classifier.name,
      routingConfig
    );
    this.complexityScorer = new ComplexityScorer();
    this.skillClassifier = new SkillClassifier();
    this.routingConfig = routingConfig;
  }

  async route(context: TaskContext): Promise<RoutingDecision> {
    const startTime = Date.now();

    // First check if this is a skill invocation
    const skillClassification = this.skillClassifier.classify(context.input);

    if (skillClassification.isSkill) {
      // Try ALL skills locally first to see what works
      // Let the orchestrator handle escalation if skill execution fails
      logger.debug('Routing skill to local (will escalate if fails)', {
        skill: skillClassification.skillName,
        type: skillClassification.skillType
      });

      return {
        target: 'local_code',
        taskType: skillClassification.skillType === 'simple' ? 'trivial_edit' : 'refactor_small',
        complexity: skillClassification.skillType === 'simple' ? 2 : 6,
        confidence: skillClassification.confidence,
        reasoning: `Skill '${skillClassification.skillName}' - will try local first, escalate if needed`,
        shouldEscalate: false
      };
    }

    const classification = await this.classifier.classify(context.input);

    const complexityScore = this.complexityScorer.score(
      classification.taskType,
      context
    );

    const taskDef = this.routingConfig.taskTypes[classification.taskType];
    let target = taskDef.route;

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
