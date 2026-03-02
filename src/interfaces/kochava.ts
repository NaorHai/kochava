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
        await runInteractiveMode();
        return;
      }

      const query = queryParts.join(' ');
      if (!query) {
        // Default to interactive mode (like Claude Code CLI)
        await runInteractiveMode();
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

      await runSingleQuery(query, context, options.verbose);
    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse();

async function runSingleQuery(query: string, context?: string, verbose?: boolean) {
  if (verbose) {
    console.log(chalk.gray('\n→ Initializing kochava...\n'));
  }

  const orchestrator = await initOrchestrator();

  if (verbose) {
    console.log(chalk.gray('→ Processing your request...\n'));
  }

  const response = await orchestrator.process(query, context);

  console.log(chalk.white(response.content));

  const modelType = response.model.includes('claude') ? 'cloud' : 'local';
  const modelColor = modelType === 'local' ? chalk.green : chalk.blue;

  console.log(
    chalk.gray(`\n[${modelColor(response.model)} • ${response.tokens} tokens • ${response.latency}ms]`)
  );
}

async function runInteractiveMode() {
  console.log(chalk.magenta(KOCHAVA_ART));
  console.log(chalk.gray('Ready to help with your coding questions. Type /help for commands or /exit to quit.\n'));

  // Suppress verbose logs for smooth conversation
  process.env.LOG_LEVEL = 'error';

  const orchestrator = await initOrchestrator();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta('kochava> ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
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

    // Process regular queries
    try {
      // Show thinking indicator
      const thinkingWords = ['Thinking', 'Pondering', 'Analyzing', 'Processing', 'Considering', 'Evaluating'];
      const thinkingWord = thinkingWords[Math.floor(Math.random() * thinkingWords.length)];
      process.stdout.write(chalk.dim(`\n${thinkingWord}...`));

      const response = await orchestrator.process(input);

      // Clear thinking indicator
      process.stdout.write('\r' + ' '.repeat(50) + '\r');

      // Clean output - just the response content
      console.log(chalk.white(`${response.content}\n`));

      // Minimal footer - transparent routing indicator
      const modelType = response.model.includes('claude') ? 'cloud' : 'local';
      const modelColor = modelType === 'local' ? chalk.green : chalk.blue;

      console.log(
        chalk.dim(`${modelColor('●')} ${response.latency}ms\n`)
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
  if (!apiKey || apiKey === 'none') {
    console.log(chalk.yellow('⚠️  No Claude API key set - using FREE local models only\n'));
  }

  const configDir = path.join(__dirname, '../../config');
  const routingConfig: RoutingConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'routing.config.json'), 'utf-8')
  );
  const modelConfig: ModelConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'model.config.json'), 'utf-8')
  );

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey || 'none');
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

function displayHelp() {
  console.log(chalk.magenta.bold('\n📖 Kochava Commands\n'));
  console.log(chalk.white('  /stats  - Show usage statistics'));
  console.log(chalk.white('  /reset  - Reset session and clear history'));
  console.log(chalk.white('  /help   - Show this help message'));
  console.log(chalk.white('  /exit   - Exit kochava'));
  console.log(chalk.gray('\nPress Ctrl+C to exit at any time'));
  console.log();
}
