import { Embedder } from './embedder.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  embedding?: number[];
}

export class CodeIndexer {
  private embedder: Embedder;
  private chunks: CodeChunk[] = [];
  private indexPath: string;

  constructor(embedder: Embedder, indexPath: string) {
    this.embedder = embedder;
    this.indexPath = indexPath;
  }

  async indexCode(filePath: string, content: string): Promise<void> {
    const chunks = this.chunkCode(content, filePath);

    for (const chunk of chunks) {
      try {
        chunk.embedding = await this.embedder.embed(chunk.content);
        this.chunks.push(chunk);
      } catch (error) {
        logger.error('Failed to embed chunk', { error, chunkId: chunk.id });
      }
    }

    logger.info('Code indexed', {
      filePath,
      chunks: chunks.length,
      totalChunks: this.chunks.length
    });
  }

  async search(query: string, topK: number = 5): Promise<CodeChunk[]> {
    if (this.chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embedder.embed(query);

    const scored = this.chunks
      .filter(chunk => chunk.embedding)
      .map(chunk => ({
        chunk,
        score: this.embedder.cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(item => item.chunk);
  }

  async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      await fs.writeFile(
        this.indexPath,
        JSON.stringify(this.chunks, null, 2),
        'utf-8'
      );
      logger.info('Index saved', { path: this.indexPath, chunks: this.chunks.length });
    } catch (error) {
      logger.error('Failed to save index', { error });
    }
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      this.chunks = JSON.parse(data);
      logger.info('Index loaded', { path: this.indexPath, chunks: this.chunks.length });
    } catch (error: any) {
      // Silently initialize empty index if file doesn't exist yet
      if (error.code === 'ENOENT') {
        this.chunks = [];
      } else {
        // Only warn for actual errors (permissions, corruption, etc.)
        logger.warn('Failed to load index', { error });
        this.chunks = [];
      }
    }
  }

  private chunkCode(content: string, filePath: string): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    const chunkSize = 50;
    const overlap = 10;

    for (let i = 0; i < lines.length; i += chunkSize - overlap) {
      const endLine = Math.min(i + chunkSize, lines.length);
      const chunkContent = lines.slice(i, endLine).join('\n');

      chunks.push({
        id: `${filePath}:${i}-${endLine}`,
        content: chunkContent,
        filePath,
        startLine: i,
        endLine
      });

      if (endLine >= lines.length) break;
    }

    return chunks;
  }

  clear(): void {
    this.chunks = [];
  }
}
