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
    const trimmed = context.input.trim();

    // 0. Bash/file operations → computer_use (HIGHEST PRIORITY)
    if (this.isBashOperation(trimmed) || this.isFileOperation(input) || this.isWriteOperation(input)) {
      logger.debug('Fast route: Bash/file/write operation → computer_use');
      return 'computer_use';
    }

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

  /**
   * Detect if input is a direct bash command
   */
  private isBashOperation(input: string): boolean {
    const bashCommands = [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'pwd', 'echo',
      'cd', 'mkdir', 'rm', 'mv', 'cp', 'touch', 'chmod', 'chown',
      'wc', 'du', 'df', 'ps', 'top', 'which', 'whereis', 'file',
      'stat', 'date', 'uptime', 'whoami', 'hostname', 'git'
    ];

    // Check if starts with bash command
    const firstWord = input.split(/\s+/)[0].toLowerCase();
    return bashCommands.includes(firstWord);
  }

  /**
   * Detect if input is asking about files/directories/system operations
   * More aggressive to catch any potential bash-related query
   */
  private isFileOperation(input: string): boolean {
    const lowerInput = input.toLowerCase();

    // File/directory keywords (expanded with common file types)
    const fileKeywords = [
      'file', 'files', 'directory', 'directories', 'folder', 'folders',
      'image', 'images', 'photo', 'photos', 'picture', 'pictures', 'pic', 'pics',
      'video', 'videos', 'movie', 'movies',
      'pdf', 'pdfs', 'document', 'documents', 'doc', 'docs',
      'txt', 'csv', 'json', 'xml', 'yaml'
    ];
    const hasFileKeyword = fileKeywords.some(kw => lowerInput.includes(kw));

    // System operation verbs (read operations)
    const readVerbs = ['list', 'show', 'display', 'find', 'search', 'count', 'get', 'view', 'check', 'see', 'name', 'names'];

    // Write/destructive operation verbs
    const writeVerbs = [
      'create', 'make', 'mkdir', 'touch',
      'write', 'save', 'edit', 'modify', 'update', 'change',
      'delete', 'remove', 'rm', 'del',
      'move', 'mv', 'rename',
      'copy', 'cp', 'duplicate'
    ];

    const hasSystemVerb = [...readVerbs, ...writeVerbs].some(verb =>
      new RegExp(`\\b${verb}\\b`).test(lowerInput)
    );

    // System keywords that suggest bash operations
    const systemKeywords = [
      'disk', 'usage', 'space', 'size', 'large', 'small',
      'process', 'running', 'memory', 'cpu',
      'hidden', 'recent', 'modified', 'created',
      'python', 'javascript', 'java', 'code', 'source',
      'grep', 'search', 'find', 'locate',
      'download', 'downloads', 'document', 'documents', 'desktop', 'home'
    ];
    const hasSystemKeyword = systemKeywords.some(kw => lowerInput.includes(kw));

    // Specific patterns (enhanced with counting and write patterns)
    const patterns = [
      // Read operations
      /\bwhat('s| is| are)\s+(in|inside)\b/i,
      /\bcount\s+\w+/i,
      /\bfind\s+\w+/i,
      /\bsearch\s+for\b/i,
      /\bshow\s+me\b/i,
      /\bhow\s+many\b/i,           // "how many files/images/etc"
      /\bhow\s+much\b/i,            // "how much space/disk/etc"
      /\bwhat.*going\s+on\b/i,     // "what's going on" (system status)
      /\bwhat\s+(are\s+)?(their|the)\s+names?\b/i,  // "what are their names", "what are the names"
      /\blist\s+(the\s+)?names?\b/i,                 // "list names", "list the names"

      // Write/destructive operations
      /\bcreate\s+(a\s+)?(file|folder|directory)\b/i,  // "create a file/folder"
      /\bmake\s+(a\s+)?(file|folder|directory)\b/i,    // "make a folder"
      /\bwrite\s+to\b/i,                                // "write to file"
      /\bsave\s+(to|in|as)\b/i,                        // "save to file"
      /\bdelete\s+(the\s+)?(file|folder)\b/i,          // "delete the file"
      /\bremove\s+(the\s+)?(file|folder)\b/i,          // "remove the folder"
      /\bmove\s+\S+/i,                                  // "move file" or "move file to"
      /\brename\s+\S+/i,                                // "rename file" or "rename file to"
      /\bcopy\s+\S+/i                                   // "copy file" or "copy file to"
    ];
    const matchesPattern = patterns.some(pattern => pattern.test(input));

    // Route to computer_use if it looks like a system/file operation
    return (hasFileKeyword && hasSystemVerb) ||
           (hasSystemVerb && hasSystemKeyword) ||
           hasFileKeyword ||  // Any file type mention
           matchesPattern;
  }

  /**
   * Detect write/destructive operations
   */
  private isWriteOperation(input: string): boolean {
    const lowerInput = input.toLowerCase();

    // Write/destructive operation keywords
    const writeKeywords = [
      'create', 'make', 'mkdir', 'touch',
      'write', 'save', 'edit', 'modify', 'update', 'change',
      'delete', 'remove', 'rm', 'del',
      'move', 'mv', 'rename',
      'copy', 'cp', 'duplicate'
    ];

    // Check if any write keyword exists
    const result = writeKeywords.some(kw => new RegExp(`\\b${kw}\\b`).test(lowerInput));

    if (result) {
      logger.debug('isWriteOperation matched', { input: input.substring(0, 100) });
    }

    return result;
  }
}
