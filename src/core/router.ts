import { TaskClassifier } from './classifier.js';
import { ComplexityScorer } from './complexity.js';
import { RoutingDecision, TaskContext, RoutingConfig, ModelConfig } from '../types/index.js';
import logger from '../utils/logger.js';

export class TaskRouter {
  private classifier: TaskClassifier;
  private complexityScorer: ComplexityScorer;
  private routingConfig: RoutingConfig;

  constructor(routingConfig: RoutingConfig, modelConfig: ModelConfig) {
    this.classifier = new TaskClassifier(
      modelConfig.models.classifier.name,
      routingConfig
    );
    this.complexityScorer = new ComplexityScorer();
    this.routingConfig = routingConfig;
  }

  async route(context: TaskContext): Promise<RoutingDecision> {
    const startTime = Date.now();

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
