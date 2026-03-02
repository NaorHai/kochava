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
  .version('1.0.0', '-v, --version', 'Output the current version')
  .usage('[options] [query]');

program
  .argument('[query...]', 'Your question or request')
  .option('-c, --chat', 'Start interactive chat mode')
  .option('-i, --interactive', 'Start interactive chat mode (alias for --chat)')
  .option('-s, --stats', 'Show usage statistics')
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

      if (options.reset) {
        console.log(chalk.yellow('✓ Session reset (restart kochava to apply)'));
        return;
      }

      if (options.chat || options.interactive) {
        await runInteractiveMode(options.model);
        return;
      }

      const query = queryParts.join(' ');
      if (!query) {
        // Default to interactive mode (like Claude Code CLI)
        await runInteractiveMode(options.model);
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

      await runSingleQuery(query, context, options.verbose, options.model);
    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();

async function runSingleQuery(query: string, context?: string, verbose?: boolean, forceModel?: string) {
  if (verbose) {
    console.log(chalk.gray('\n→ Initializing kochava...\n'));
  }

  const orchestrator = await initOrchestrator();

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

async function runInteractiveMode(forceModel?: string) {
  console.log(chalk.magenta(KOCHAVA_ART));

  if (forceModel) {
    const modelType = forceModel.toLowerCase() === 'claude' ? 'Claude API' : 'Local';
    console.log(chalk.yellow(`Forcing ${modelType} for all requests\n`));
  }

  console.log(chalk.gray('Ready to help with your coding questions. Type /help for commands or /exit to quit.\n'));

  // Suppress verbose logs for smooth conversation
  process.env.LOG_LEVEL = 'error';

  const orchestrator = await initOrchestrator();

  // Load available skills for auto-complete
  const availableSkills = await getAvailableSkills();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta('kochava> '),
    completer: (line: string) => {
      return completeSkills(line, availableSkills);
    }
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Show skills if user just types "/"
    if (input === '/') {
      await showAvailableSkills();
      rl.prompt();
      return;
    }

    // Handle commands without thinking indicator
    if (input === '/exit' || input === 'exit' || input === '/quit' || input === 'quit') {
      console.log(chalk.magenta('\nGoodbye! 👋\n'));
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
      await showAvailableSkills();
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
      // Show thinking indicator
      const thinkingWords = ['Thinking', 'Pondering', 'Analyzing', 'Processing', 'Considering', 'Evaluating'];
      const thinkingWord = thinkingWords[Math.floor(Math.random() * thinkingWords.length)];
      process.stdout.write(chalk.dim(`\n${thinkingWord}...`));

      const response = await orchestrator.process(input, undefined, forceModel);

      // Clear thinking indicator
      process.stdout.write('\r' + ' '.repeat(50) + '\r');

      // Clean output - just the response content
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

  rl.on('close', () => {
    console.log(chalk.magenta('\nGoodbye! 👋\n'));
    process.exit(0);
  });
}

async function showStats() {
  const orchestrator = await initOrchestrator();
  displayMetrics(orchestrator);
}

async function initOrchestrator(): Promise<AIOrchestrator> {
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

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, finalApiKey, bedrockBaseURL);
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

async function getAvailableSkills(): Promise<string[]> {
  try {
    const skillsPath = path.join(process.env.HOME || '', '.claude/blueprints/sf-adlc/skills.json');
    const skillsData = await fs.readFile(skillsPath, 'utf-8');
    const skillsConfig = JSON.parse(skillsData);

    if (skillsConfig.skills && Array.isArray(skillsConfig.skills)) {
      return skillsConfig.skills
        .filter((s: any) => s.name)
        .map((s: any) => s.name);
    }
  } catch (error) {
    // No skills available
  }

  return [];
}

function completeSkills(line: string, skills: string[]): [string[], string] {
  // If line starts with /, complete skill names
  if (line.startsWith('/')) {
    const partial = line.slice(1).toLowerCase();
    const hits = skills.filter(s => s.toLowerCase().startsWith(partial));
    return [hits.map(h => `/${h}`), line];
  }

  // Also complete built-in commands
  const builtinCommands = ['/help', '/stats', '/reset', '/exit', '/skills'];
  if (line.startsWith('/')) {
    const partial = line.toLowerCase();
    const hits = builtinCommands.filter(c => c.startsWith(partial));
    return [hits, line];
  }

  return [[], line];
}

async function showAvailableSkills() {
  const skills = await getAvailableSkills();

  if (skills.length === 0) {
    console.log(chalk.yellow('\n⚠️  No skills found in ~/.claude/blueprints/sf-adlc/skills.json\n'));
    return;
  }

  console.log(chalk.magenta.bold('\n🔧 Available Skills\n'));

  // Group skills by category
  const adlcSkills = skills.filter(s => s.startsWith('adlc-'));
  const otherSkills = skills.filter(s => !s.startsWith('adlc-'));

  if (adlcSkills.length > 0) {
    console.log(chalk.cyan('ADLC Workflow:'));
    adlcSkills.forEach(skill => {
      console.log(chalk.white(`  /${skill}`));
    });
    console.log();
  }

  if (otherSkills.length > 0) {
    console.log(chalk.cyan('Other:'));
    otherSkills.forEach(skill => {
      console.log(chalk.white(`  /${skill}`));
    });
    console.log();
  }

  console.log(chalk.gray('Type /skill-name to use a skill'));
  console.log(chalk.gray('Tab to auto-complete skill names\n'));
}

function displayHelp() {
  console.log(chalk.magenta.bold('\n📖 Kochava Commands\n'));
  console.log(chalk.white('  /stats        - Show usage statistics'));
  console.log(chalk.white('  /skills       - List available skills'));
  console.log(chalk.white('  /skill-stats  - Show which skills work locally vs need Claude'));
  console.log(chalk.white('  /reset        - Reset session and clear history'));
  console.log(chalk.white('  /help         - Show this help message'));
  console.log(chalk.white('  /exit         - Exit kochava'));
  console.log(chalk.gray('\nSkills:'));
  console.log(chalk.white('  /              - Show all skills'));
  console.log(chalk.white('  /skill-name [args]  - Execute a skill (Tab to auto-complete)'));
  console.log(chalk.gray('\nOptions:'));
  console.log(chalk.white('  -m, --model <type>  Force model (local or claude)'));
  console.log(chalk.white('  -v, --verbose       Enable verbose output'));
  console.log(chalk.gray('\nPress Ctrl+C to exit at any time'));
  console.log();
}
