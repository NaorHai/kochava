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
   */
  async initialize(toolCatalog: ToolCatalog): Promise<void> {
    const startTime = Date.now();
    this.toolEmbeddings = [];

    // Embed all skills
    for (const skill of toolCatalog.skills) {
      const description = `${skill.name}: ${skill.description || 'No description'}`;
      const embedding = await this.embedder.embed(description);

      this.toolEmbeddings.push({
        name: skill.name,
        type: 'skill',
        embedding,
        description: skill.description || ''
      });
    }

    // Embed all MCP tools
    for (const tool of toolCatalog.mcpTools) {
      const description = `${tool.name}: ${tool.description || 'No description'}`;
      const embedding = await this.embedder.embed(description);

      this.toolEmbeddings.push({
        name: tool.name,
        type: 'mcp',
        embedding,
        description: tool.description || ''
      });
    }

    this.initialized = true;
    const elapsed = Date.now() - startTime;

    logger.debug('Tool embeddings computed', {
      totalTools: this.toolEmbeddings.length,
      skills: toolCatalog.skills.length,
      mcps: toolCatalog.mcpTools.length,
      elapsed
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
   * Get lightweight tool descriptions for top-K relevant tools
   */
  async getRelevantToolDescriptions(query: string, topK: number = 10): Promise<string> {
    const relevantTools = await this.findRelevantTools(query, topK);

    if (relevantTools.length === 0) {
      return '';
    }

    const descriptions = relevantTools
      .filter(t => t.score >= 0.25) // Only include moderately relevant tools
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    if (!descriptions) {
      return '';
    }

    return `\nAVAILABLE TOOLS (use if relevant to task):\n${descriptions}\n\nTo use a tool: TOOL_USE: tool_name param1="value1" param2="value2"\n`;
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
