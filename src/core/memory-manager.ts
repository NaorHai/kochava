import { ConversationTurn, RoutingConfig } from '../types/index.js';
import { estimateTokens } from '../utils/token-counter.js';
import { Ollama } from 'ollama';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface SessionData {
  id: string;
  history: ConversationTurn[];
  createdAt: number;
  lastUpdated: number;
}

export class MemoryManager {
  private history: ConversationTurn[] = [];
  private config: RoutingConfig;
  private ollama: Ollama;
  private summaryModel: string;
  private sessionId: string;
  private sessionsDir: string;

  constructor(config: RoutingConfig, summaryModel: string, sessionId?: string) {
    this.config = config;
    this.summaryModel = summaryModel;
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.sessionId = sessionId || this.generateSessionId();
    this.sessionsDir = path.join(os.homedir(), '.kochava', 'sessions');
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}-${random}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async initialize(): Promise<void> {
    // Ensure sessions directory exists
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory', { error });
    }
  }

  async loadSession(sessionId: string): Promise<boolean> {
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf-8');
      const session: SessionData = JSON.parse(data);

      this.history = session.history;
      this.sessionId = session.id;

      logger.info('Session loaded', { sessionId, turns: this.history.length });
      return true;
    } catch (error) {
      logger.debug('Failed to load session', { sessionId, error });
      return false;
    }
  }

  async saveSession(): Promise<void> {
    try {
      const sessionData: SessionData = {
        id: this.sessionId,
        history: this.history,
        createdAt: this.history[0]?.timestamp || Date.now(),
        lastUpdated: Date.now()
      };

      const sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));

      // Clean up old sessions (keep only last 3)
      await this.cleanupOldSessions();

      logger.debug('Session saved', { sessionId: this.sessionId });
    } catch (error) {
      logger.error('Failed to save session', { error, sessionId: this.sessionId });
    }
  }

  private async cleanupOldSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: { file: string; mtime: number }[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.sessionsDir, file);
        const stats = await fs.stat(filePath);
        sessions.push({ file, mtime: stats.mtimeMs });
      }

      // Sort by modification time, newest first
      sessions.sort((a, b) => b.mtime - a.mtime);

      // Delete sessions beyond the last 3
      for (let i = 3; i < sessions.length; i++) {
        const filePath = path.join(this.sessionsDir, sessions[i].file);
        await fs.unlink(filePath);
        logger.debug('Cleaned up old session', { file: sessions[i].file });
      }
    } catch (error) {
      logger.debug('Failed to cleanup old sessions', { error });
    }
  }

  async listRecentSessions(): Promise<{ id: string; lastUpdated: number; turnCount: number }[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: { id: string; lastUpdated: number; turnCount: number }[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.sessionsDir, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const session: SessionData = JSON.parse(data);

        sessions.push({
          id: session.id,
          lastUpdated: session.lastUpdated,
          turnCount: session.history.length
        });
      }

      // Sort by last updated, newest first
      sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);

      return sessions.slice(0, 3);
    } catch (error) {
      logger.debug('Failed to list sessions', { error });
      return [];
    }
  }

  addTurn(role: 'user' | 'assistant', content: string): void {
    const turn: ConversationTurn = {
      role,
      content,
      tokens: estimateTokens(content),
      timestamp: Date.now()
    };

    this.history.push(turn);

    if (this.shouldSummarize()) {
      this.summarizeHistory().catch(error => {
        logger.error('Failed to summarize history', { error });
      });
    }
  }

  getHistory(): ConversationTurn[] {
    return [...this.history];
  }

  getRecentHistory(maxTokens: number): ConversationTurn[] {
    const recent: ConversationTurn[] = [];
    let tokenCount = 0;

    for (let i = this.history.length - 1; i >= 0; i--) {
      const turn = this.history[i];
      const turnTokens = turn.tokens || estimateTokens(turn.content);

      if (tokenCount + turnTokens > maxTokens) {
        break;
      }

      recent.unshift(turn);
      tokenCount += turnTokens;
    }

    return recent;
  }

  clear(): void {
    this.history = [];
  }

  private shouldSummarize(): boolean {
    if (!this.config.memoryManagement.enableRollingSummary) {
      return false;
    }

    if (this.history.length < this.config.memoryManagement.maxTurnsBeforeSummary) {
      return false;
    }

    const totalTokens = this.history.reduce(
      (sum, turn) => sum + (turn.tokens || estimateTokens(turn.content)),
      0
    );

    return totalTokens > this.config.memoryManagement.maxHistoryTokens;
  }

  private async summarizeHistory(): Promise<void> {
    if (this.history.length < 3) {
      return;
    }

    try {
      const conversationText = this.history
        .map(turn => `${turn.role}: ${turn.content}`)
        .join('\n\n');

      const prompt = `Summarize this conversation history concisely, preserving key context and decisions. Keep it under 300 words:

${conversationText}

Summary:`;

      const response = await this.ollama.generate({
        model: this.summaryModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 512
        }
      });

      const summary = response.response.trim();

      this.history = [
        {
          role: 'assistant',
          content: `[Summary of previous conversation]\n${summary}`,
          tokens: estimateTokens(summary),
          timestamp: Date.now()
        },
        ...this.history.slice(-2)
      ];

      logger.info('Conversation history summarized', {
        originalTurns: this.history.length,
        newTurns: 3
      });
    } catch (error) {
      logger.error('Summarization failed', { error });
    }
  }
}
