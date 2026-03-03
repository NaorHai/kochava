import { Ollama } from 'ollama';
import logger from '../utils/logger.js';

/**
 * Intelligent Bash Command Translator
 *
 * Uses a lightweight local model to translate natural language → bash commands.
 * Much more robust than hard-coded patterns.
 *
 * Examples:
 * - "list all downloads files" → "ls -la ~/Downloads"
 * - "find large files" → "find . -type f -size +100M"
 * - "show me python files" → "find . -name '*.py'"
 * - "count lines in all js files" → "find . -name '*.js' | xargs wc -l"
 */
export class BashTranslator {
  private ollama: Ollama;
  private modelName: string;
  private cache: Map<string, string>;

  constructor(modelName: string = 'phi3') {
    this.ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });
    this.modelName = modelName;
    this.cache = new Map();
  }

  /**
   * Translate natural language to bash command using AI
   */
  async translate(naturalLanguage: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(naturalLanguage.toLowerCase());
    if (cached) {
      logger.debug('Bash translator cache hit', { input: naturalLanguage.substring(0, 50) });
      return cached;
    }

    try {
      const startTime = Date.now();

      const prompt = `Convert this request into a bash command. Output ONLY the command, no explanations.

RULES:
- "list" or "show" = list files (NO wc -l)
- "how many" or "count" = count files (USE wc -l)
- Keep commands SIMPLE - avoid complex grep patterns

EXAMPLES:
"show me all python files" → find . -name "*.py"
"list images on desktop" → ls -1 ~/Desktop 2>/dev/null | grep -iE '\\.(jpg|png|gif|jpeg|bmp)$'
"list files on desktop" → ls -1 ~/Desktop
"show files on downloads" → ls -1 ~/Downloads
"how many images in desktop" → ls -1 ~/Desktop 2>/dev/null | grep -iE '\\.(jpg|png|gif|jpeg|bmp|pdf)$' | wc -l
"count files in downloads" → ls -1 ~/Downloads | wc -l
"how many files in downloads" → ls -1 ~/Downloads | wc -l
"find large files bigger than 100MB" → find . -type f -size +100M
"count lines in all javascript files" → find . -name "*.js" -exec wc -l {} +
"show disk usage" → df -h
"list hidden files" → ls -la | grep "^\."
"show running processes" → ps aux
"search for TODO in source code" → grep -r "TODO" .
"find files modified today" → find . -type f -mtime 0
"what's going on" → ps aux

REQUEST: ${naturalLanguage}
COMMAND:`;

      const response = await this.ollama.generate({
        model: this.modelName,
        prompt,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for deterministic output
          num_predict: 100, // Short output (just one command)
          num_ctx: 512 // Small context window
        }
      });

      const bashCommand = response.response.trim();
      const latency = Date.now() - startTime;

      logger.debug('Bash translator executed', {
        input: naturalLanguage.substring(0, 50),
        output: bashCommand.substring(0, 100),
        latency
      });

      // Validate output
      if (!bashCommand || bashCommand === 'CANNOT_TRANSLATE' || bashCommand.length > 500) {
        return null;
      }

      // Remove markdown artifacts if any
      const cleaned = this.cleanBashCommand(bashCommand);

      // Cache successful translation
      if (cleaned && cleaned.length < 200) {
        this.cache.set(naturalLanguage.toLowerCase(), cleaned);
      }

      return cleaned;
    } catch (error: any) {
      logger.debug('Bash translator failed', {
        error: error.message,
        input: naturalLanguage.substring(0, 50)
      });
      return null;
    }
  }

  /**
   * Clean up model output to extract pure bash command
   */
  private cleanBashCommand(output: string): string | null {
    let cleaned = output.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```(?:bash|sh|shell)?\n?/g, '');
    cleaned = cleaned.replace(/```$/g, '');

    // Remove backticks
    cleaned = cleaned.replace(/^`|`$/g, '');

    // Take only first line if multiline
    const firstLine = cleaned.split('\n')[0].trim();

    // Basic validation - must look like a command
    if (!firstLine || firstLine.length > 500) {
      return null;
    }

    // Must start with a common command or path
    const commonCommands = [
      'ls', 'cat', 'grep', 'find', 'head', 'tail', 'wc', 'du', 'df',
      'ps', 'top', 'pwd', 'echo', 'which', 'whereis', 'file', 'stat',
      'cd', 'mkdir', 'touch', 'cp', 'mv', 'rm', 'chmod', 'chown',
      'git', 'npm', 'node', 'python', 'docker', 'curl', 'wget'
    ];

    const firstWord = firstLine.split(/\s+/)[0].toLowerCase();
    const looksLikeBash = commonCommands.includes(firstWord) ||
                          firstWord.startsWith('/') ||
                          firstWord.startsWith('~');

    if (!looksLikeBash) {
      logger.debug('Output does not look like bash', { output: firstLine });
      return null;
    }

    return firstLine;
  }

  /**
   * Check if model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.ollama.list();
      return response.models.some(m => m.name === this.modelName || m.name.startsWith(this.modelName));
    } catch {
      return false;
    }
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
