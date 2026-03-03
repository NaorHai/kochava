import { Embedder } from '../retrieval/embedder.js';
import { ToolCatalog } from './tool-discovery.js';
import logger from '../utils/logger.js';

interface ToolEmbedding {
  name: string;
  type: 'skill' | 'mcp';
  embedding: number[];
  description: string;
}

interface ToolRelevance {
  name: string;
  type: 'skill' | 'mcp';
  score: number;
  description: string;
}

/**
 * Semantic Tool Router using embedding-based similarity
 *
 * Zero maintenance, fully scalable approach:
 * 1. Pre-embed all tools once at startup
 * 2. Embed incoming query
 * 3. Compute cosine similarity
 * 4. Return top-K relevant tools
 * 5. Let model decide whether to use them
 *
 * This is the production-ready, Claude Code pattern.
 */
export class SemanticToolRouter {
  private embedder: Embedder;
  private toolEmbeddings: ToolEmbedding[] = [];
  private initialized: boolean = false;

  constructor(embeddingModelName: string) {
    this.embedder = new Embedder(embeddingModelName);
  }

  /**
   * Pre-compute embeddings for all tools (run once at startup)
   * OPTIMIZED: Batched parallel embedding for fast initialization
   */
  async initialize(toolCatalog: ToolCatalog): Promise<void> {
    const startTime = Date.now();
    this.toolEmbeddings = [];

    // Batch size to avoid overwhelming Ollama
    const BATCH_SIZE = 10;

    // Combine all tools for batched processing
    const allTools: Array<{item: any; type: 'skill' | 'mcp'}> = [
      ...toolCatalog.skills.map(skill => ({ item: skill, type: 'skill' as const })),
      ...toolCatalog.mcpTools.map(tool => ({ item: tool, type: 'mcp' as const }))
    ];

    // Process in batches
    for (let i = 0; i < allTools.length; i += BATCH_SIZE) {
      const batch = allTools.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async ({ item, type }) => {
        const description = `${item.name}: ${item.description || 'No description'}`;
        const embedding = await this.embedder.embed(description);

        return {
          name: item.name,
          type,
          embedding,
          description: item.description || ''
        };
      });

      // Process batch in parallel
      const batchResults = await Promise.all(batchPromises);
      this.toolEmbeddings.push(...batchResults);
    }

    this.initialized = true;
    const elapsed = Date.now() - startTime;

    logger.debug('Tool embeddings computed (batched parallel)', {
      totalTools: this.toolEmbeddings.length,
      skills: toolCatalog.skills.length,
      mcps: toolCatalog.mcpTools.length,
      elapsed,
      batchSize: BATCH_SIZE
    });
  }

  /**
   * Find top-K most relevant tools for a query using semantic similarity
   */
  async findRelevantTools(query: string, topK: number = 10): Promise<ToolRelevance[]> {
    if (!this.initialized) {
      logger.warn('Semantic tool router not initialized');
      return [];
    }

    // Embed the query
    const queryEmbedding = await this.embedder.embed(query);

    // Compute cosine similarity with all tools
    const similarities: ToolRelevance[] = [];

    for (const tool of this.toolEmbeddings) {
      const score = this.cosineSimilarity(queryEmbedding, tool.embedding);

      similarities.push({
        name: tool.name,
        type: tool.type,
        score,
        description: tool.description
      });
    }

    // Sort by score descending and return top-K
    similarities.sort((a, b) => b.score - a.score);

    const topTools = similarities.slice(0, topK);

    logger.debug('Relevant tools found', {
      query: query.substring(0, 100),
      topK,
      topScores: topTools.slice(0, 3).map(t => ({ name: t.name, score: t.score.toFixed(3) }))
    });

    return topTools;
  }

  /**
   * Determine if query needs tools based on relevance threshold
   */
  async shouldInjectTools(query: string, threshold: number = 0.3): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    const topTool = (await this.findRelevantTools(query, 1))[0];

    if (!topTool) {
      return false;
    }

    const needsTools = topTool.score >= threshold;

    logger.debug('Tool injection decision', {
      query: query.substring(0, 50),
      topTool: topTool.name,
      score: topTool.score.toFixed(3),
      threshold,
      decision: needsTools
    });

    return needsTools;
  }

  /**
   * Detect if query is a simple bash/file operation that doesn't need tools
   */
  private isSimpleBashOperation(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim();

    // Common bash commands that should execute directly
    const bashCommands = [
      'ls', 'list', 'dir', 'pwd', 'cd', 'cat', 'head', 'tail',
      'grep', 'find', 'echo', 'mkdir', 'rm', 'mv', 'cp', 'touch',
      'chmod', 'chown', 'du', 'df', 'wc', 'sort', 'uniq'
    ];

    // Patterns that indicate simple file operations
    const bashPatterns = [
      /^(list|show|display|print|get)\s+(files?|directories?|folders?)\s+in/i,
      /^ls\s+/i,
      /^cat\s+/i,
      /^(what|show).+(in|inside)\s+~?\/?[\w\/-]+/i, // "what files in ~/Source"
      /^(check|show|display)\s+directory/i
    ];

    // Check if starts with common bash command
    const startsWithBash = bashCommands.some(cmd => {
      const regex = new RegExp(`^${cmd}\\b`, 'i');
      return regex.test(lowerQuery);
    });

    // Check if matches bash operation pattern
    const matchesBashPattern = bashPatterns.some(pattern => pattern.test(query));

    if (startsWithBash || matchesBashPattern) {
      logger.debug('Simple bash operation detected - skipping tool injection', {
        query: query.substring(0, 100)
      });
    }

    return startsWithBash || matchesBashPattern;
  }

  /**
   * Get lightweight tool descriptions for top-K relevant tools
   */
  async getRelevantToolDescriptions(query: string, topK: number = 10): Promise<string> {
    // For direct skill invocations (e.g., /budget), skip tool injection
    // The skill will be executed directly via tryDirectSkillExecution()
    if (query.trim().startsWith('/')) {
      return '';
    }

    // For simple bash operations, inject ONLY the shell tool with clear instructions
    if (this.isSimpleBashOperation(query)) {
      return `\nAVAILABLE TOOLS:
- shell: Execute bash/shell commands directly (ls, cat, grep, find, etc.). Use for file operations, system commands, and terminal tasks.

IMPORTANT: Use the shell tool to execute the command. Format: TOOL_USE: shell command="your bash command here"
Example: TOOL_USE: shell command="ls ~/Source"
`;
    }

    const relevantTools = await this.findRelevantTools(query, topK);

    if (relevantTools.length === 0) {
      return '';
    }

    // Only inject highly relevant tools (>60% similarity) to reduce noise
    const descriptions = relevantTools
      .filter(t => t.score >= 0.60)
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    if (!descriptions) {
      return '';
    }

    return `\nAVAILABLE TOOLS (use ONLY if directly needed for this task):\n${descriptions}\n\nIMPORTANT: For simple requests, respond directly without tools. Only use tools when explicitly needed.\nTo use a tool: TOOL_USE: tool_name param1="value1" param2="value2"\n`;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get stats
   */
  getStats(): { totalTools: number; skills: number; mcps: number } {
    const skills = this.toolEmbeddings.filter(t => t.type === 'skill').length;
    const mcps = this.toolEmbeddings.filter(t => t.type === 'mcp').length;

    return {
      totalTools: this.toolEmbeddings.length,
      skills,
      mcps
    };
  }
}
