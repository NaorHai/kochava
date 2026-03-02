import { Ollama } from 'ollama';
import logger from '../utils/logger.js';

export class Embedder {
  private ollama: Ollama;
  private modelName: string;

  constructor(modelName: string) {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.modelName = modelName;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.ollama.embeddings({
        model: this.modelName,
        prompt: text
      });

      return response.embedding;
    } catch (error) {
      logger.error('Embedding failed', { error, text: text.slice(0, 50) });
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
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
}
