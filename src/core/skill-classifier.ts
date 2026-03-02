import logger from '../utils/logger.js';

export interface SkillClassification {
  isSkill: boolean;
  skillType?: 'simple' | 'complex';
  skillName?: string;
  confidence: number;
}

export class SkillClassifier {
  // Simple skills that can be handled by local models
  private simpleSkills = [
    'format',
    'lint',
    'explain',
    'comment',
    'document',
    'summarize',
    'translate',
    'convert',
    'rename',
    'extract',
  ];

  // Complex skills that need Claude
  private complexSkills = [
    'refactor',
    'debug',
    'architect',
    'design',
    'review',
    'analyze',
    'optimize',
    'test',
    'security',
  ];

  // Claude Code agent patterns
  private agentPatterns = [
    /\bagent\s+(\w+)/i,
    /\/(\w+)\s+agent/i,
    /@(\w+)\s*:/i,
  ];

  classify(input: string): SkillClassification {
    const lowerInput = input.toLowerCase().trim();

    // Check for explicit skill invocation (e.g., "format this", "lint code")
    for (const skill of this.simpleSkills) {
      if (lowerInput.startsWith(skill) || lowerInput.includes(`${skill} this`) || lowerInput.includes(`${skill} code`)) {
        logger.debug('Detected simple skill', { skill, input: input.slice(0, 50) });
        return {
          isSkill: true,
          skillType: 'simple',
          skillName: skill,
          confidence: 0.9
        };
      }
    }

    for (const skill of this.complexSkills) {
      if (lowerInput.startsWith(skill) || lowerInput.includes(`${skill} this`) || lowerInput.includes(`${skill} code`)) {
        logger.debug('Detected complex skill', { skill, input: input.slice(0, 50) });
        return {
          isSkill: true,
          skillType: 'complex',
          skillName: skill,
          confidence: 0.9
        };
      }
    }

    // Check for Claude Code agent patterns
    for (const pattern of this.agentPatterns) {
      const match = input.match(pattern);
      if (match) {
        const agentName = match[1].toLowerCase();

        // Simple agents
        if (['formatter', 'linter', 'explainer', 'commenter'].includes(agentName)) {
          logger.debug('Detected simple agent', { agent: agentName });
          return {
            isSkill: true,
            skillType: 'simple',
            skillName: agentName,
            confidence: 0.85
          };
        }

        // Complex agents
        logger.debug('Detected complex agent', { agent: agentName });
        return {
          isSkill: true,
          skillType: 'complex',
          skillName: agentName,
          confidence: 0.85
        };
      }
    }

    // Not a skill
    return {
      isSkill: false,
      confidence: 0.0
    };
  }

  shouldUseLocalForSkill(classification: SkillClassification, inputLength: number): boolean {
    if (!classification.isSkill) {
      return false;
    }

    // Always use local for simple skills
    if (classification.skillType === 'simple') {
      return true;
    }

    // For complex skills, use local only if input is short (< 500 chars)
    if (classification.skillType === 'complex' && inputLength < 500) {
      logger.debug('Using local for short complex skill', {
        skill: classification.skillName,
        length: inputLength
      });
      return true;
    }

    return false;
  }
}
