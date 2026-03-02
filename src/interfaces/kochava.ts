#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { AIOrchestrator } from '../core/orchestrator.js';
import { RoutingConfig, ModelConfig } from '../types/index.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { showSkillMenu } from '../utils/interactive-menu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Suppress verbose logs in interactive mode for smooth conversation
if (process.argv.length === 2 || process.argv.includes('--chat') || process.argv.includes('-c') || process.argv.includes('--interactive') || process.argv.includes('-i')) {
  process.env.LOG_LEVEL = 'error';
}

const program = new Command();

const KOCHAVA_ART = `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██╗  ██╗ ██████╗  ██████╗██╗  ██╗ █████╗ ██╗   ██╗ █████╗     ║
║   ██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██╔══██╗██║   ██║██╔══██╗    ║
║   █████╔╝ ██║   ██║██║     ███████║███████║██║   ██║███████║    ║
║   ██╔═██╗ ██║   ██║██║     ██╔══██║██╔══██║╚██╗ ██╔╝██╔══██║    ║
║   ██║  ██╗╚██████╔╝╚██████╗██║  ██║██║  ██║ ╚████╔╝ ██║  ██║    ║
║   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝    ║
║                                                                   ║
║            Intelligent AI Router • Local + Cloud                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`;

program
  .name('kochava')
  .description('Intelligent AI routing with local models and Claude')
  .version('1.0.1', '-v, --version', 'Output the current version')
  .usage('[options] [query]');

program
  .argument('[query...]', 'Your question or request')
  .option('-c, --chat', 'Start interactive chat mode')
  .option('-i, --interactive', 'Start interactive chat mode (alias for --chat)')
  .option('-s, --stats', 'Show usage statistics')
  .option('--sessions', 'List recent sessions')
  .option('--session <id>', 'Resume a previous session by ID')
  .option('-r, --reset', 'Reset session and token counters')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-m, --model <type>', 'Force specific model (local or claude)')
  .option('--file <path>', 'Load code context from file')
  .option('--no-color', 'Disable colored output')
  .action(async (queryParts, options) => {
    try {
      if (options.stats) {
        await showStats();
        return;
      }

      if (options.sessions) {
        await listSessions();
        return;
      }

      if (options.reset) {
        console.log(chalk.yellow('✓ Session reset (restart kochava to apply)'));
        return;
      }

      if (options.chat || options.interactive) {
        await runInteractiveMode(options.model, options.session);
        return;
      }

      const query = queryParts.join(' ');
      if (!query) {
        // Default to interactive mode (like Claude Code CLI)
        await runInteractiveMode(options.model, options.session);
        return;
      }

      let context: string | undefined;
      if (options.file) {
        try {
          context = await fs.readFile(options.file, 'utf-8');
        } catch (error) {
          console.error(chalk.red(`✗ Failed to read file: ${options.file}`));
          process.exit(1);
        }
      }

      await runSingleQuery(query, context, options.verbose, options.model, options.session);
    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();

async function runSingleQuery(query: string, context?: string, verbose?: boolean, forceModel?: string, sessionId?: string) {
  if (verbose) {
    console.log(chalk.gray('\n→ Initializing kochava...\n'));
  }

  const orchestrator = await initOrchestrator(sessionId);

  if (verbose) {
    console.log(chalk.gray('→ Processing your request...\n'));
  }

  const response = await orchestrator.process(query, context, forceModel);

  console.log(chalk.white(response.content));

  const modelType = response.model.includes('claude') ? 'cloud' : 'local';
  const modelColor = modelType === 'local' ? chalk.green : chalk.blue;

  console.log(
    chalk.gray(`\n[${modelColor(response.model)} • ${response.tokens} tokens • ${response.latency}ms]`)
  );
}

async function runInteractiveMode(forceModel?: string, sessionId?: string) {
  console.log(chalk.magenta(KOCHAVA_ART));

  if (sessionId) {
    console.log(chalk.cyan(`Resuming session: ${sessionId}\n`));
  }

  if (forceModel) {
    const modelType = forceModel.toLowerCase() === 'claude' ? 'Claude API' : 'Local';
    console.log(chalk.yellow(`Forcing ${modelType} for all requests\n`));
  }

  // Suppress verbose logs for smooth conversation
  process.env.LOG_LEVEL = 'error';

  // Load skills and orchestrator in parallel with progress indicator
  const startTime = Date.now();
  process.stdout.write(chalk.gray('Loading...'));

  const [orchestrator, availableSkills] = await Promise.all([
    initOrchestrator(sessionId),
    getAvailableSkills()
  ]);

  const currentSessionId = orchestrator.getSessionId();
  const elapsed = Date.now() - startTime;
  process.stdout.write('\r' + ' '.repeat(20) + '\r'); // Clear loading

  if (availableSkills.length > 0) {
    console.log(chalk.green(`✓ Ready! ${availableSkills.length} skills loaded (${elapsed}ms)`));
    console.log(chalk.gray('  Press Tab to auto-complete • Type / to list skills • /help for commands\n'));
  } else {
    console.log(chalk.yellow(`⚠️  Ready but no skills found in ~/.claude/blueprints/`));
    console.log(chalk.gray('  Type /help for commands or /exit to quit.\n'));
  }

  // All commands (skills + built-in)
  const allCommands = [
    ...availableSkills.map(s => `/${s}`),
    '/help',
    '/stats',
    '/skills',
    '/skill-stats',
    '/reset',
    '/exit',
    '/quit'
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta('kochava> '),
    completer: (line: string) => {
      const trimmed = line.trim();

      // If starts with /, complete commands/skills
      if (trimmed.startsWith('/')) {
        const hits = allCommands.filter(c => c.toLowerCase().startsWith(trimmed.toLowerCase()));

        // If no matches, show all
        if (hits.length === 0) {
          return [allCommands, trimmed];
        }

        return [hits, trimmed];
      }

      // Not a command, no completion
      return [[], line];
    }
  });

  // Override _ttyWrite to detect "/" and show interactive menu
  let menuActive = false; // Prevent multiple menus
  const originalTtyWrite = (rl as any)._ttyWrite;
  (rl as any)._ttyWrite = async function(s: string, key: any) {
    // Call original first
    originalTtyWrite.call(this, s, key);

    // Check if current line is exactly "/"
    const currentLine = (this as any).line || '';
    if (currentLine === '/' && s === '/' && !menuActive) {
      menuActive = true;
      // User just typed "/", show interactive menu
      setTimeout(async () => {
        // Clear the "/" from the line
        (this as any).line = '';
        (this as any).cursor = 0;
        (this as any)._refreshLine();

        // Show interactive menu
        const selected = await showSkillMenu(allCommands);
        menuActive = false;

        if (selected) {
          // User selected something
          (this as any).line = '';
          (this as any).cursor = 0;

          // Auto-submit if it's a complete command
          if (selected.startsWith('/')) {
            // Check if it's a built-in command (no execution indicator needed)
            const builtinCommands = ['/help', '/stats', '/skills', '/skill-stats', '/reset', '/exit', '/quit', '/', '/?'];
            const isBuiltin = builtinCommands.includes(selected);

            if (!isBuiltin) {
              // Show that we're executing the skill
              console.log(chalk.magenta(`\n→ ${selected}...\n`));
            }

            // Emit the line event - the async handler will process it and call prompt() when done
            (this as any).emit('line', selected);
          } else {
            // Not a command, just insert it
            (this as any).line = selected;
            (this as any).cursor = selected.length;
            (this as any)._refreshLine();
          }
        } else {
          // User cancelled, restore prompt
          (this as any).prompt();
        }
      }, 10);
    }
  };

  // Show startup tip with clear instructions
  if (availableSkills.length > 0) {
    console.log(chalk.cyan.bold(`✨ ${availableSkills.length} skills loaded!`));
    console.log(chalk.gray(`   Just type "/" to see all • Keep typing to filter\n`));
  }

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Show skills if user just types "/" or "/?"
    if (input === '/' || input === '/?') {
      displaySkillsList(availableSkills);
      rl.prompt();
      return;
    }

    // Handle built-in commands without thinking indicator
    if (input === '/exit' || input === 'exit' || input === '/quit' || input === 'quit') {
      await orchestrator.saveSession();
      console.log(chalk.magenta('\n👋 Goodbye!\n'));
      console.log(chalk.gray('Session saved:') + ' ' + chalk.cyan(currentSessionId));
      console.log(chalk.gray('Resume later with:') + ' ' + chalk.white(`kochava --session ${currentSessionId}\n`));
      rl.close();
      process.exit(0);
    }

    if (input === '/stats' || input === 'stats') {
      displayMetrics(orchestrator);
      rl.prompt();
      return;
    }

    if (input === '/reset' || input === 'reset') {
      orchestrator.resetSession();
      console.log(chalk.yellow('\n✓ Session reset\n'));
      rl.prompt();
      return;
    }

    if (input === '/help' || input === 'help') {
      displayHelp();
      rl.prompt();
      return;
    }

    if (input === '/skills' || input === 'skills') {
      displaySkillsList(availableSkills);
      rl.prompt();
      return;
    }

    if (input === '/skill-stats' || input === 'skill-stats') {
      const tracker = orchestrator.getSkillTracker();
      console.log(tracker.displayStats());
      rl.prompt();
      return;
    }

    // Process regular queries
    try {
      // Show thinking indicator (no newline, overwrite current line)
      const thinkingWords = [
        'Thinking', 'Pondering', 'Analyzing', 'Processing', 'Considering', 'Evaluating',
        'Contemplating', 'Deliberating', 'Reasoning', 'Reflecting', 'Meditating', 'Ruminating',
        'Brainstorming', 'Ideating', 'Synthesizing', 'Formulating', 'Conceptualizing', 'Theorizing',
        'Calculating', 'Computing', 'Deducing', 'Inferring', 'Extrapolating', 'Interpolating',
        'Investigating', 'Exploring', 'Examining', 'Scrutinizing', 'Inspecting', 'Probing',
        'Deciphering', 'Decoding', 'Unraveling', 'Untangling', 'Dissecting', 'Parsing',
        'Strategizing', 'Planning', 'Orchestrating', 'Choreographing', 'Architecting', 'Designing',
        'Crafting', 'Engineering', 'Constructing', 'Building', 'Assembling', 'Composing',
        'Optimizing', 'Refining', 'Polishing', 'Enhancing', 'Perfecting', 'Fine-tuning',
        'Discovering', 'Uncovering', 'Revealing', 'Illuminating', 'Clarifying', 'Elucidating',
        'Navigating', 'Traversing', 'Journeying', 'Venturing', 'Pioneering', 'Trailblazing',
        'Synthesizing', 'Integrating', 'Merging', 'Fusing', 'Blending', 'Harmonizing',
        'Envisioning', 'Imagining', 'Visualizing', 'Dreaming', 'Innovating', 'Creating',
        'Resolving', 'Solving', 'Cracking', 'Unlocking', 'Breaking', 'Figuring',
        'Calibrating', 'Adjusting', 'Tuning', 'Balancing', 'Aligning', 'Synchronizing',
        'Channeling', 'Focusing', 'Concentrating', 'Honing', 'Zeroing', 'Targeting',
        'Brewing', 'Cooking', 'Baking', 'Simmering', 'Distilling', 'Fermenting',
        'Weaving', 'Knitting', 'Stitching', 'Threading', 'Spinning', 'Lacing'
      ];
      const thinkingWord = thinkingWords[Math.floor(Math.random() * thinkingWords.length)];
      process.stdout.write('\r' + chalk.dim(`${thinkingWord}...`));

      const response = await orchestrator.process(input, undefined, forceModel);

      // Clear thinking indicator and print response
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      console.log(chalk.white(`${response.content}\n`));

      // Minimal footer - just model name
      const modelType = response.model.includes('claude') ? 'cloud' : 'local';
      const modelColor = modelType === 'local' ? chalk.green : chalk.blue;

      console.log(
        chalk.dim(`[${modelColor(response.model)}]\n`)
      );
    } catch (error: any) {
      // Clear thinking indicator on error
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      console.error(chalk.red(`✗ ${error.message}\n`));
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await orchestrator.saveSession();
    console.log(chalk.magenta('\n👋 Goodbye!\n'));
    console.log(chalk.gray('Session saved:') + ' ' + chalk.cyan(currentSessionId));
    console.log(chalk.gray('Resume later with:') + ' ' + chalk.white(`kochava --session ${currentSessionId}\n`));
    process.exit(0);
  });
}

async function showStats() {
  const orchestrator = await initOrchestrator();
  displayMetrics(orchestrator);
}

async function listSessions() {
  const orchestrator = await initOrchestrator();
  const sessions = await orchestrator.listRecentSessions();

  if (sessions.length === 0) {
    console.log(chalk.yellow('\n⚠️  No recent sessions found\n'));
    return;
  }

  console.log(chalk.magenta.bold('\n📜 Recent Sessions\n'));

  for (const session of sessions) {
    const date = new Date(session.lastUpdated);
    const timeAgo = formatTimeAgo(session.lastUpdated);

    console.log(chalk.cyan(`${session.id}`));
    console.log(chalk.gray(`  ${session.turnCount} messages • ${timeAgo} • ${date.toLocaleString()}`));
    console.log(chalk.gray(`  Resume: ${chalk.white(`kochava --session ${session.id}`)}\n`));
  }
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

async function initOrchestrator(sessionId?: string): Promise<AIOrchestrator> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const bedrockBaseURL = process.env.ANTHROPIC_BEDROCK_BASE_URL;
  const skipBedrockAuth = process.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH === '1';

  if (!apiKey || apiKey === 'none') {
    console.log(chalk.yellow('⚠️  No Claude API key set - using FREE local models only\n'));
  } else if (bedrockBaseURL) {
    logger.debug('Using AWS Bedrock endpoint', { skipAuth: skipBedrockAuth });
  }

  const configDir = path.join(__dirname, '../../config');
  const routingConfig: RoutingConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'routing.config.json'), 'utf-8')
  );
  const modelConfig: ModelConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'model.config.json'), 'utf-8')
  );

  // Use dummy API key for Bedrock if auth is skipped (gateway handles auth)
  const finalApiKey = bedrockBaseURL && skipBedrockAuth ? 'bedrock-gateway' : (apiKey || 'none');

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, finalApiKey, bedrockBaseURL, sessionId);
  await orchestrator.initialize();

  return orchestrator;
}

function displayMetrics(orchestrator: AIOrchestrator) {
  const metrics = orchestrator.getMetrics();
  const localRatio = metrics.totalRequests > 0
    ? (metrics.localRequests / metrics.totalRequests * 100).toFixed(1)
    : '0';

  console.log(chalk.magenta.bold('\n📊 Usage Statistics\n'));
  console.log(chalk.white(`Total Requests:    ${metrics.totalRequests}`));
  console.log(chalk.green(`Local (FREE):      ${metrics.localRequests} (${localRatio}%)`));
  console.log(chalk.blue(`Claude (Cloud):    ${metrics.claudeRequests}`));
  console.log(chalk.yellow(`Tokens Saved:      ${metrics.tokensSaved.toLocaleString()}`));
  console.log(chalk.magenta(`Claude Tokens:     ${metrics.claudeTokensUsed.toLocaleString()}`));
  console.log(chalk.gray(`Avg Latency:       ${Math.round(metrics.avgLatency)}ms`));

  if (metrics.totalRequests > 0) {
    const estimatedSavings = (metrics.tokensSaved * 0.003).toFixed(2);
    const estimatedCost = (metrics.claudeTokensUsed * 0.003).toFixed(2);
    console.log(chalk.green(`\nEstimated Savings: $${estimatedSavings}`));
    console.log(chalk.yellow(`Claude Cost:       $${estimatedCost}`));
  }
  console.log();
}

async function findSkillsInPlugins(): Promise<string[]> {
  const skills: string[] = [];

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Find all SKILL.md files
    const { stdout } = await execAsync('find ~/.claude/plugins -name "SKILL.md" -type f 2>/dev/null');
    const skillFiles = stdout.trim().split('\n').filter(Boolean);

    for (const skillFile of skillFiles) {
      try {
        const content = await fs.readFile(skillFile, 'utf-8');
        // Extract skill name from path or frontmatter
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        if (nameMatch) {
          skills.push(nameMatch[1].trim());
        } else {
          // Extract from directory name
          const parts = skillFile.split('/');
          const skillName = parts[parts.length - 2]; // Directory name
          if (skillName && skillName !== 'skills') {
            skills.push(skillName);
          }
        }
      } catch (error) {
        // Skip unreadable files
      }
    }
  } catch (error) {
    // find command failed, skip
  }

  return skills;
}

async function getAvailableSkills(): Promise<string[]> {
  const skills: string[] = [];

  // 1. Load from blueprints (ADLC skills)
  try {
    const skillsPath = path.join(process.env.HOME || '', '.claude/blueprints/sf-adlc/skills.json');
    const skillsData = await fs.readFile(skillsPath, 'utf-8');
    const skillsConfig = JSON.parse(skillsData);

    if (skillsConfig.skills && Array.isArray(skillsConfig.skills)) {
      skills.push(...skillsConfig.skills
        .filter((s: any) => s.name)
        .map((s: any) => s.name));
    }
  } catch (error) {
    // No ADLC skills
  }

  // 2. Load from commands directory
  try {
    const commandsPath = path.join(process.env.HOME || '', '.claude/commands');
    const files = await fs.readdir(commandsPath);
    const mdFiles = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    skills.push(...mdFiles);
  } catch (error) {
    // No commands
  }

  // 3. Load from plugin skills
  const pluginSkills = await findSkillsInPlugins();
  skills.push(...pluginSkills);

  // Remove duplicates and sort
  return [...new Set(skills)].sort();
}

function displaySkillsList(skills: string[]) {
  if (skills.length === 0) {
    console.log(chalk.yellow('\n⚠️  No skills found\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n🔧 Available Skills\n'));

  // Group skills by category
  const adlcSkills = skills.filter(s => s.startsWith('adlc-'));
  const otherSkills = skills.filter(s => !s.startsWith('adlc-'));

  if (adlcSkills.length > 0) {
    console.log(chalk.magenta('ADLC Workflow:'));
    const cols = 2;
    for (let i = 0; i < adlcSkills.length; i += cols) {
      const row = adlcSkills.slice(i, i + cols);
      console.log(chalk.white('  ' + row.map(s => `/${s.padEnd(30)}`).join('')));
    }
    console.log();
  }

  if (otherSkills.length > 0) {
    console.log(chalk.magenta('Other Skills:'));
    const cols = 3;
    for (let i = 0; i < otherSkills.length; i += cols) {
      const row = otherSkills.slice(i, i + cols);
      console.log(chalk.white('  ' + row.map(s => `/${s.padEnd(20)}`).join('')));
    }
    console.log();
  }

  console.log(chalk.gray('💡 Press Tab to auto-complete • Type / to list • /help for commands\n'));
}

function displayHelp() {
  console.log(chalk.magenta.bold('\n📖 Kochava Help\n'));

  console.log(chalk.cyan('Commands:'));
  console.log(chalk.white('  /stats        - Show usage statistics'));
  console.log(chalk.white('  /skills       - List all available skills'));
  console.log(chalk.white('  /skill-stats  - See which skills work locally vs need Claude'));
  console.log(chalk.white('  /reset        - Reset session and clear history'));
  console.log(chalk.white('  /help         - Show this help message'));
  console.log(chalk.white('  /exit         - Exit kochava (saves session)'));

  console.log(chalk.cyan('\nSessions:'));
  console.log(chalk.white('  --sessions              - List recent sessions'));
  console.log(chalk.white('  --session <id>          - Resume previous session'));
  console.log(chalk.dim('  Sessions are saved automatically and last 3 kept'));

  console.log(chalk.cyan('\nSkills:'));
  console.log(chalk.white('  /                    - Show all available skills'));
  console.log(chalk.white('  /skill-name [args]   - Execute a skill'));
  console.log(chalk.dim('  Examples: /simplify, /adlc-architect W-12345'));

  console.log(chalk.cyan('\nAuto-Complete:'));
  console.log(chalk.white('  Type / and press Tab  - See all commands/skills'));
  console.log(chalk.white('  Type /adlc- and Tab   - See ADLC skills'));
  console.log(chalk.white('  Type /sim and Tab     - Complete to /simplify'));

  console.log(chalk.cyan('\nCommand Line Options:'));
  console.log(chalk.white('  -m, --model <type>   - Force model (local or claude)'));
  console.log(chalk.white('  -v, --verbose        - Enable verbose output'));

  console.log(chalk.gray('\nPress Ctrl+C to exit at any time'));
  console.log();
}
