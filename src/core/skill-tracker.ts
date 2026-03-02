import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';
import logger from '../utils/logger.js';

interface SkillStats {
  skill: string;
  localSuccesses: number;
  localFailures: number;
  claudeSuccesses: number;
  lastLocalAttempt?: number;
  lastClaudeAttempt?: number;
}

export class SkillTracker {
  private stats: Map<string, SkillStats> = new Map();
  private statsPath: string;
  private loaded: boolean = false;

  constructor() {
    const kochavaDir = path.join(homedir(), '.kochava');
    this.statsPath = path.join(kochavaDir, 'skill-stats.json');
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await fs.readFile(this.statsPath, 'utf-8');
      const statsArray = JSON.parse(data);

      for (const stat of statsArray) {
        this.stats.set(stat.skill, stat);
      }

      this.loaded = true;
      logger.debug('Skill stats loaded', { skills: this.stats.size });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, that's fine
        this.loaded = true;
      } else {
        logger.debug('Failed to load skill stats', { error: error.message });
      }
    }
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.statsPath);
      await fs.mkdir(dir, { recursive: true });

      const statsArray = Array.from(this.stats.values());
      await fs.writeFile(this.statsPath, JSON.stringify(statsArray, null, 2), 'utf-8');

      logger.debug('Skill stats saved', { skills: statsArray.length });
    } catch (error: any) {
      logger.debug('Failed to save skill stats', { error: error.message });
    }
  }

  recordLocalSuccess(skill: string): void {
    const stats = this.getOrCreateStats(skill);
    stats.localSuccesses++;
    stats.lastLocalAttempt = Date.now();
    this.save(); // Fire and forget
  }

  recordLocalFailure(skill: string): void {
    const stats = this.getOrCreateStats(skill);
    stats.localFailures++;
    stats.lastLocalAttempt = Date.now();
    this.save();
  }

  recordClaudeSuccess(skill: string): void {
    const stats = this.getOrCreateStats(skill);
    stats.claudeSuccesses++;
    stats.lastClaudeAttempt = Date.now();
    this.save();
  }

  shouldTryLocal(skill: string): boolean {
    const stats = this.stats.get(skill);

    if (!stats) {
      // Never tried, always try local first
      return true;
    }

    // If local has succeeded before, try it
    if (stats.localSuccesses > 0) {
      return true;
    }

    // If local has failed 3+ times and never succeeded, skip it
    if (stats.localFailures >= 3 && stats.localSuccesses === 0) {
      return false;
    }

    // Otherwise try it
    return true;
  }

  getStats(skill: string): SkillStats | undefined {
    return this.stats.get(skill);
  }

  getAllStats(): SkillStats[] {
    return Array.from(this.stats.values())
      .sort((a, b) => {
        // Sort by total attempts
        const aTotal = a.localSuccesses + a.localFailures + a.claudeSuccesses;
        const bTotal = b.localSuccesses + b.localFailures + b.claudeSuccesses;
        return bTotal - aTotal;
      });
  }

  private getOrCreateStats(skill: string): SkillStats {
    let stats = this.stats.get(skill);

    if (!stats) {
      stats = {
        skill,
        localSuccesses: 0,
        localFailures: 0,
        claudeSuccesses: 0
      };
      this.stats.set(skill, stats);
    }

    return stats;
  }

  getRecommendation(skill: string): 'local' | 'claude' | 'unknown' {
    const stats = this.stats.get(skill);

    if (!stats) {
      return 'unknown';
    }

    // If local works reliably (>50% success rate), recommend it
    const localTotal = stats.localSuccesses + stats.localFailures;
    if (localTotal > 0) {
      const localSuccessRate = stats.localSuccesses / localTotal;
      if (localSuccessRate > 0.5) {
        return 'local';
      }
    }

    // If local never worked after multiple tries, recommend Claude
    if (stats.localFailures >= 3 && stats.localSuccesses === 0) {
      return 'claude';
    }

    return 'unknown';
  }

  displayStats(): string {
    const stats = this.getAllStats();

    if (stats.length === 0) {
      return 'No skill usage data yet';
    }

    let output = '\n📊 Skill Usage Statistics\n\n';

    // Skills that work locally
    const localSkills = stats.filter(s => s.localSuccesses > 0);
    if (localSkills.length > 0) {
      output += '✅ Works Locally (FREE):\n';
      for (const skill of localSkills.slice(0, 10)) {
        const total = skill.localSuccesses + skill.localFailures;
        const rate = ((skill.localSuccesses / total) * 100).toFixed(0);
        output += `  /${skill.skill} (${rate}% success, ${total} attempts)\n`;
      }
      output += '\n';
    }

    // Skills that need Claude
    const claudeSkills = stats.filter(s => s.localFailures >= 3 && s.localSuccesses === 0);
    if (claudeSkills.length > 0) {
      output += '☁️  Requires Claude:\n';
      for (const skill of claudeSkills.slice(0, 10)) {
        output += `  /${skill.skill} (${skill.claudeSuccesses} uses)\n`;
      }
      output += '\n';
    }

    return output;
  }
}
