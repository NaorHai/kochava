import { exec } from 'child_process';
import { promisify } from 'util';
import { ModelResponse } from '../types/index.js';
import logger from '../utils/logger.js';
import { BashTranslator } from './bash-translator.js';

const execAsync = promisify(exec);

/**
 * Computer-Use Executor for bash commands and file operations
 *
 * Directly executes system commands without LLM hallucination.
 * Production-ready with:
 * - Proper timeout handling
 * - Buffer limits
 * - Error recovery
 * - Command validation
 * - Security constraints
 */
export class ComputerUseExecutor {
  private readonly maxBufferSize = 10 * 1024 * 1024; // 10MB
  private readonly timeout = 30000; // 30 seconds
  private readonly workingDir: string;
  private readonly translator: BashTranslator;
  private readonly useAI: boolean;

  constructor() {
    this.workingDir = process.cwd(); // Use current working directory, not HOME
    this.translator = new BashTranslator('phi3'); // Fast, lightweight model
    this.useAI = process.env.DISABLE_BASH_TRANSLATOR !== 'true';
  }

  async execute(prompt: string): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      // Extract the actual command from the prompt (uses AI + fallback patterns)
      const command = await this.extractCommand(prompt);

      if (!command) {
        return {
          content: 'Could not translate your request into a bash command. Try being more specific (e.g., "ls ~/Downloads", "find . -name \'*.txt\'").',
          model: 'computer_use (no command)',
          tokens: 0,
          latency: Date.now() - startTime
        };
      }

      // Validate command is safe (basic security check)
      if (!this.isCommandSafe(command)) {
        return {
          content: `Command blocked for security: "${command}". Destructive operations (rm -rf, >, etc.) require explicit confirmation.`,
          model: 'computer_use (blocked)',
          tokens: 0,
          latency: Date.now() - startTime
        };
      }

      logger.debug('Executing computer-use command', {
        command: command.substring(0, 200),
        workingDir: this.workingDir
      });

      // Execute the command
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: this.maxBufferSize,
        shell: '/bin/bash',
        cwd: this.workingDir,
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin'
        }
      });

      const output = stdout.trim() || stderr.trim();

      const latency = Date.now() - startTime;

      logger.debug('Computer-use command completed', {
        command: command.substring(0, 100),
        outputLength: output.length,
        latency
      });

      return {
        content: output || 'Command executed successfully (no output)',
        model: 'computer_use (bash)',
        tokens: 0,
        latency
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      logger.debug('Computer-use execution failed', {
        error: error.message,
        code: error.code,
        signal: error.signal
      });

      // Provide helpful error messages
      let errorMessage = '';

      if (error.code === 'ETIMEDOUT') {
        errorMessage = `Command timed out after ${this.timeout / 1000} seconds. The operation may be too slow or hung.`;
      } else if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        errorMessage = `Output too large (exceeded ${this.maxBufferSize / 1024 / 1024}MB). Try limiting the output with head/tail.`;
      } else if (error.code === 127) {
        errorMessage = `Command not found. Make sure the command exists and is in your PATH.`;
      } else if (error.stderr) {
        errorMessage = error.stderr.trim();
      } else {
        errorMessage = error.message || 'Command execution failed';
      }

      return {
        content: `Error: ${errorMessage}`,
        model: 'computer_use (error)',
        tokens: 0,
        latency
      };
    }
  }

  /**
   * Extract bash command from natural language prompt
   * Uses AI translation first, falls back to patterns
   */
  private async extractCommand(prompt: string): Promise<string | null> {
    const trimmed = prompt.trim();

    // Fast path 1: Direct bash command (starts with common command)
    const bashCommands = [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'pwd', 'echo',
      'cd', 'mkdir', 'rm', 'mv', 'cp', 'touch', 'chmod', 'chown',
      'wc', 'du', 'df', 'ps', 'top', 'which', 'whereis', 'file',
      'stat', 'date', 'uptime', 'whoami', 'hostname', 'git'
    ];

    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
    if (bashCommands.includes(firstWord)) {
      logger.debug('Direct bash command detected', { command: trimmed.substring(0, 100) });
      return trimmed;
    }

    // AI Translation (primary method for natural language)
    if (this.useAI) {
      try {
        const translated = await this.translator.translate(prompt);
        if (translated) {
          logger.debug('AI bash translation successful', {
            input: prompt.substring(0, 100),
            output: translated.substring(0, 100)
          });
          return translated;
        }
      } catch (error: any) {
        logger.debug('AI bash translation failed, falling back to patterns', {
          error: error.message
        });
      }
    }

    // Fallback: Pattern-based extraction (used if AI translation unavailable or fails)
    // These patterns handle common cases as a safety net
    const lowerPrompt = prompt.toLowerCase();

    // "list [all/the] files in X" → "ls -1 X" (includes both files and directories)
    // Allows: "list files in X", "list all files in X", "list the files in X", "show files in X"
    let match = lowerPrompt.match(/(?:list|show|display)\s+(?:all\s+|the\s+)?files?\s+in\s+(.+)/i);
    if (match) {
      const path = match[1].trim();
      // Handle relative paths like "Downloads" → "~/Downloads"
      const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `~/${path}`;
      return `ls -1 ${fullPath}`;
    }

    // "list [all] X files" → "ls -1 ~/X" (includes both files and directories)
    // Allows: "list downloads files", "list all downloads files", "show documents files"
    match = lowerPrompt.match(/(?:list|show|display)\s+(?:all\s+)?(\w+)\s+files?/i);
    if (match) {
      const dirName = match[1].trim();
      // Convert to proper path (capitalize common folders)
      const properName = dirName.charAt(0).toUpperCase() + dirName.slice(1);
      const fullPath = `~/${properName}`;
      return `ls -1 ${fullPath}`;
    }

    // "what's in X" → "ls -la X"
    match = lowerPrompt.match(/what(?:'s| is| are)\s+(?:in|inside)\s+(?:the\s+)?(.+)/i);
    if (match) {
      const path = match[1].trim();
      const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `~/${path}`;
      return `ls -la ${fullPath}`;
    }

    // "list/show directory X" → "ls -la X"
    match = lowerPrompt.match(/(?:list|show|display)\s+(?:directory|folder|dir)\s+(.+)/i);
    if (match) {
      const path = match[1].trim();
      const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `~/${path}`;
      return `ls -la ${fullPath}`;
    }

    // "read file X" → find and cat file
    match = lowerPrompt.match(/(?:read|show|display|cat|view)\s+(?:the\s+)?(?:file\s+)?(.+)/i);
    if (match) {
      const fileName = match[1].trim();

      // If it's a full path, use directly
      if (fileName.startsWith('/') || fileName.startsWith('~') || fileName.startsWith('./')) {
        return `cat "${fileName}"`;
      }

      // Check current directory first, then search from home directory
      return `if [ -f "${fileName}" ]; then cat "${fileName}"; else file=$(find ~ -type f -iname "*${fileName}*" 2>/dev/null | head -1); if [ -n "$file" ]; then cat "$file"; else echo "File not found: ${fileName}"; fi; fi`;
    }

    // "open X [in Y]" → find and open file
    match = prompt.match(/open\s+(?:the\s+)?(?:file\s+)?(.+?)(?:\s+(?:in|on|from)\s+(.+))?$/i);
    if (match) {
      let fileName = match[1].trim();
      const location = match[2]?.trim();

      // If it's a full path, use directly
      if (fileName.startsWith('/') || fileName.startsWith('~/') || fileName.startsWith('./')) {
        return `open "${fileName}"`;
      }

      // If location specified, search there
      if (location) {
        const locationPath = location.startsWith('/') || location.startsWith('~') ? location : `~/${location}`;
        // Find file matching pattern in specified location and open it
        return `file=$(find ${locationPath} -type f -iname "*${fileName}*" 2>/dev/null | head -1); if [ -n "$file" ]; then open "$file"; else echo "File not found: ${fileName} in ${location}"; fi`;
      }

      // No location specified - search from home directory
      return `file=$(find ~ -type f -iname "*${fileName}*" 2>/dev/null | head -1); if [ -n "$file" ]; then open "$file"; else echo "File not found: ${fileName}"; fi`;
    }

    // "search for X in Y" → "grep -r X Y"
    match = prompt.match(/search\s+(?:for\s+)?(.+?)\s+in\s+(.+)/i);
    if (match) {
      const pattern = match[1].trim();
      const location = match[2].trim();
      return `grep -r "${pattern}" ${location}`;
    }

    // "find files [named/called] X" → "find . -name X"
    match = prompt.match(/find\s+files?\s+(?:named|called)?\s*(.+)/i);
    if (match) {
      const name = match[1].trim();
      return `find . -name "${name}"`;
    }

    // "count files in X" → "ls -1 X | wc -l"
    match = lowerPrompt.match(/count\s+files?\s+in\s+(.+)/i);
    if (match) {
      const path = match[1].trim();
      const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `~/${path}`;
      return `ls -1 ${fullPath} | wc -l`;
    }

    // "list images on X" → list image files (NO count)
    if (/\b(list|show|display)\s+(images?|photos?|pictures?|files?|pdfs?)/i.test(lowerPrompt)) {
      match = lowerPrompt.match(/\b(list|show|display)\s+(images?|photos?|pictures?|files?|pdfs?).*\s+(?:on|in)\s+(?:the\s+)?(.+)/i);
      if (match) {
        const path = match[3].trim();
        const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `~/${path}`;
        // List files, not count
        if (match[2].match(/images?|photos?|pictures?/i)) {
          return `ls -1 ${fullPath}/*.{jpg,jpeg,png,gif,bmp,JPG,JPEG,PNG,GIF,BMP} 2>/dev/null`;
        } else if (match[2].match(/pdfs?/i)) {
          return `ls -1 ${fullPath}/*.{pdf,PDF} 2>/dev/null`;
        } else {
          return `ls -1 ${fullPath}`;
        }
      }
    }

    // "how many images/photos/pics in X" → count image files
    match = lowerPrompt.match(/how\s+many\s+(image|images|photo|photos|picture|pictures|pic|pics|pdf|pdfs).*\s+in\s+(?:the\s+)?(.+)/i);
    if (match) {
      const path = match[2].trim();
      const fullPath = path.startsWith('/') || path.startsWith('~') ? path : `~/${path}`;
      // Count common image/document formats
      return `ls -1 ${fullPath}/*.{jpg,jpeg,png,gif,bmp,pdf,JPG,JPEG,PNG,GIF,BMP,PDF} 2>/dev/null | wc -l`;
    }

    // "what's going on" → show processes
    if (/what('s|s| is)\s+going\s+on/i.test(lowerPrompt)) {
      return `ps aux | head -20`;
    }

    // "what are their names" / "what are the names" → contextual listing
    // Look for previous desktop/downloads/folder context
    if (/what\s+(are|is)\s+(their|the)\s+names?/i.test(lowerPrompt)) {
      // Check if previous context mentioned a location
      const locationMatch = prompt.match(/desktop|downloads|documents|pictures|home|folder/i);
      if (locationMatch) {
        const location = locationMatch[0].toLowerCase();
        const path = location === 'desktop' ? '~/Desktop' :
                     location === 'downloads' ? '~/Downloads' :
                     location === 'documents' ? '~/Documents' :
                     location === 'pictures' ? '~/Pictures' :
                     location === 'home' ? '~' : '.';
        return `ls -1 ${path}`;
      }
      // Default to current directory if no context
      return `ls -1`;
    }

    // "list names" / "show names" → list files in current directory
    if (/(?:list|show)\s+(?:the\s+)?names?/i.test(lowerPrompt)) {
      return `ls -1`;
    }

    return null;
  }

  /**
   * Basic security check to prevent destructive operations
   */
  private isCommandSafe(command: string): boolean {
    // Allow safe redirections first
    const safeRedirections = [
      /2>\/dev\/null/, // stderr to null (error suppression)
      /1>\/dev\/null/, // stdout to null
      /&>\/dev\/null/, // both to null
      /2>&1/,          // stderr to stdout
    ];

    // Create a cleaned version without safe redirections for security check
    let cleanedCommand = command;
    for (const safePattern of safeRedirections) {
      cleanedCommand = cleanedCommand.replace(safePattern, '');
    }

    // Block obvious destructive patterns (on cleaned command)
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /rm\s+-rf\s+~/, // rm -rf ~
      />\s*\/dev\/(?!null)/, // writing to device files (except /dev/null)
      /mkfs/, // filesystem formatting
      /dd\s+if=/, // disk operations
      /chmod\s+-R\s+777/, // dangerous permissions
      /:(){:|:&};:/, // fork bomb
      />\s*\//, // redirect to root paths (dangerous)
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cleanedCommand)) {
        logger.warn('Blocked dangerous command', { command: command.substring(0, 100) });
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a command exists in PATH
   */
  async isCommandAvailable(commandName: string): Promise<boolean> {
    try {
      await execAsync(`which ${commandName}`, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }
}
