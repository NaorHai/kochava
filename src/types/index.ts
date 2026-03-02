export type TaskType =
  | 'trivial_edit'
  | 'formatting'
  | 'explanation'
  | 'refactor_small'
  | 'deep_debug'
  | 'architecture'
  | 'multi_file_reasoning';

export type RouteTarget = 'local_code' | 'local_compress' | 'claude';

export interface ClassificationResult {
  taskType: TaskType;
  confidence: number;
  reasoning: string;
}

export interface ComplexityScore {
  score: number;
  factors: {
    linesOfCode?: number;
    filesInvolved?: number;
    dependencies?: number;
    reasoning?: number;
  };
}

export interface RoutingDecision {
  target: RouteTarget;
  taskType: TaskType;
  complexity: number;
  confidence: number;
  reasoning: string;
  shouldEscalate: boolean;
}

export interface TaskContext {
  input: string;
  codeContext?: string;
  fileCount?: number;
  history?: ConversationTurn[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  timestamp: number;
}

export interface ModelResponse {
  content: string;
  model: string;
  tokens: number;
  latency: number;
  cached?: boolean;
}

export interface OptimizedContext {
  original: string;
  optimized: string;
  tokensSaved: number;
  operations: string[];
}

export interface ModelConfig {
  models: {
    classifier: ModelDef;
    compressor: ModelDef;
    codeEditor: ModelDef;
    embedding: ModelDef;
  };
  downloadOrder: string[];
  availableModels?: {
    codeEditors: ModelOption[];
    compressors: ModelOption[];
    classifiers: ModelOption[];
    embeddings: ModelOption[];
  };
  profiles?: Record<string, ModelProfile>;
}

export interface ModelOption {
  name: string;
  description: string;
  size: string;
  recommended: boolean;
}

export interface ModelProfile {
  name: string;
  description: string;
  models: {
    codeEditor: string;
    compressor: string;
    classifier: string;
    embedding: string;
  };
}

export interface ModelDef {
  name: string;
  purpose: string;
  maxTokens: number;
  temperature?: number;
  dimensions?: number;
}

export interface RoutingConfig {
  taskTypes: Record<TaskType, TaskTypeDef>;
  complexityThresholds: {
    local: number;
    claude: number;
  };
  contextOptimization: ContextOptimizationConfig;
  memoryManagement: MemoryManagementConfig;
  escalation: EscalationConfig;
}

export interface TaskTypeDef {
  description: string;
  route: RouteTarget;
  maxComplexity: number;
  keywords: string[];
}

export interface ContextOptimizationConfig {
  stripComments: boolean;
  removeBlankLines: boolean;
  deduplicateImports: boolean;
  maxContextTokens: number;
}

export interface MemoryManagementConfig {
  maxTurnsBeforeSummary: number;
  maxHistoryTokens: number;
  enableRollingSummary: boolean;
}

export interface EscalationConfig {
  enabled: boolean;
  allowClaudeOverride: boolean;
  confidenceThreshold: number;
}

export interface UsageMetrics {
  totalRequests: number;
  localRequests: number;
  claudeRequests: number;
  tokensSaved: number;
  claudeTokensUsed: number;
  avgLatency: number;
}
