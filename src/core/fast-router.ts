import { RouteTarget, TaskContext } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Fast-path heuristic router - makes instant routing decisions without classifier
 * for obvious cases. Falls back to classifier for ambiguous cases.
 */
export class FastRouter {
  /**
   * Try to route using fast heuristics. Returns null if classifier needed.
   */
  tryFastRoute(context: TaskContext): RouteTarget | null {
    const input = context.input.toLowerCase();

    // 1. Multi-file operations → Claude
    if (context.fileCount && context.fileCount > 3) {
      logger.debug('Fast route: Multi-file → Claude', { fileCount: context.fileCount });
      return 'claude';
    }

    // 2. Architecture/design keywords → Claude
    const complexKeywords = [
      'architecture', 'design', 'refactor all', 'redesign',
      'entire codebase', 'system design', 'scale this',
      'migrate', 'restructure'
    ];
    if (complexKeywords.some(kw => input.includes(kw))) {
      logger.debug('Fast route: Complex task → Claude');
      return 'claude';
    }

    // 3. Direct skill invocation → local_general
    if (input.trim().startsWith('/')) {
      logger.debug('Fast route: Skill invocation → local_general');
      return 'local_general';
    }

    // 4. Pure code formatting → local_code
    const formatKeywords = ['format', 'indent', 'prettify', 'style'];
    const isCodeEdit = formatKeywords.some(kw => input.includes(kw)) && context.codeContext;
    if (isCodeEdit) {
      logger.debug('Fast route: Code formatting → local_code');
      return 'local_code';
    }

    // 5. Summarization requests → local_compress
    const summaryKeywords = ['summarize', 'tldr', 'explain this code', 'what does this do', 'explain what this'];
    const isSummary = summaryKeywords.some(kw => input.includes(kw)) && context.codeContext;
    if (isSummary) {
      logger.debug('Fast route: Summarization → local_compress');
      return 'local_compress';
    }

    // 6. API/External data queries → Claude (needs MCP tools)
    const apiKeywords = [
      'github', 'gh ', 'slack', 'jira', 'gus', 'confluence',
      'pr ', 'pull request', 'commit', 'issue', 'my repo',
      'api', 'endpoint', 'database', 'query db'
    ];
    const needsAPI = apiKeywords.some(kw => input.includes(kw));
    if (needsAPI) {
      logger.debug('Fast route: API/External data → Claude');
      return 'claude';
    }

    // 7. Action verbs suggest general tasks → local_general
    const actionVerbs = ['get', 'find', 'search', 'list', 'show', 'fetch', 'retrieve', 'check'];
    const hasActionVerb = actionVerbs.some(verb => {
      // Match word boundaries to avoid false positives
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(input);
    });
    if (hasActionVerb) {
      logger.debug('Fast route: Action verb → local_general');
      return 'local_general';
    }

    // 8. Questions and conversations → local_general
    const questionPatterns = [
      /^(what|how|why|when|where|who|can|should|would|is|are|do|does)/i,
      /\?$/
    ];
    if (questionPatterns.some(pattern => pattern.test(input))) {
      logger.debug('Fast route: Question → local_general');
      return 'local_general';
    }

    // Ambiguous - need classifier
    logger.debug('Fast route: Ambiguous → Need classifier');
    return null;
  }

  /**
   * Estimate if task needs tools based on prompt
   */
  shouldInjectTools(input: string): boolean {
    const lowerInput = input.toLowerCase();

    // Action verbs that typically need tools
    const toolActionVerbs = [
      'get', 'find', 'search', 'list', 'fetch', 'retrieve',
      'create', 'update', 'delete', 'send', 'post'
    ];

    // Service mentions (use word boundaries for short keywords)
    const servicePatterns = [
      /\bgithub\b/i, /\bslack\b/i, /\bconfluence\b/i, /\bgus\b/i,
      /\bpull request\b/i, /\bissue\b/i, /\brepository\b/i, /\brepo\b/i,
      /\bmessage\b/i, /\bchannel\b/i, /\bpage\b/i, /\bdocument\b/i,
      /\bwork item\b/i, /\bw-\d/i,  // w- followed by digit
      /\b(?:open|closed|merged) pr\b/i  // pr with context
    ];

    // Internal knowledge indicators - questions about people, teams, org structure
    const internalKnowledgePatterns = [
      /\bwho (?:is|are|was|were|works?|owns?|manages?|leads?)\b/i,
      /\b(?:director|manager|lead|owner|team|engineering|engineers?|developers?)\b/i,
      /\b(?:team members?|org chart|organization|department)\b/i,
      /\b(?:contact|email|reach out|ask|talk to)\b/i
    ];

    // Direct skill/tool invocation
    if (input.trim().startsWith('/')) {
      return true;
    }

    // Check for action verbs
    const hasToolAction = toolActionVerbs.some(verb => {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(lowerInput);
    });

    // Check for service mentions
    const mentionsService = servicePatterns.some(pattern => pattern.test(input));

    // Check for internal knowledge queries
    const needsInternalKnowledge = internalKnowledgePatterns.some(pattern => pattern.test(input));

    return hasToolAction || mentionsService || needsInternalKnowledge;
  }
}
