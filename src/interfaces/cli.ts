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

dotenv.config();

const program = new Command();

program
  .name('ai-router')
  .description('Autonomous multi-model routing system with local SLMs and Claude API')
  .version('1.0.0');

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    await runInteractive();
  });

program
  .command('query')
  .alias('q')
  .description('Process a single query')
  .argument('<input>', 'Query to process')
  .option('-c, --context <file>', 'Code context file')
  .action(async (input, options) => {
    await runQuery(input, options.context);
  });

program
  .command('stats')
  .description('Show usage statistics')
  .action(async () => {
    await showStats();
  });

program
  .command('reset')
  .description('Reset session and token counters')
  .action(async () => {
    console.log(chalk.yellow('Session reset (restart CLI to take effect)'));
  });

if (process.argv.length === 2) {
  runInteractive();
} else {
  program.parse();
}

async function runInteractive() {
  console.log(chalk.cyan.bold('\n🤖 AI Router - Interactive Mode\n'));
  console.log(chalk.gray('Commands: /stats, /reset, /quit, /help\n'));

  const orchestrator = await initOrchestrator();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/quit' || input === '/exit') {
      console.log(chalk.cyan('Goodbye!\n'));
      rl.close();
      process.exit(0);
    }

    if (input === '/stats') {
      displayMetrics(orchestrator);
      rl.prompt();
      return;
    }

    if (input === '/reset') {
      orchestrator.resetSession();
      console.log(chalk.yellow('✓ Session reset\n'));
      rl.prompt();
      return;
    }

    if (input === '/help') {
      displayHelp();
      rl.prompt();
      return;
    }

    try {
      console.log(chalk.gray('Processing...\n'));

      const response = await orchestrator.process(input);

      console.log(chalk.white(response.content));
      console.log(chalk.gray(`\n[${response.model} | ${response.tokens} tokens | ${response.latency}ms]\n`));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}\n`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\nGoodbye!\n'));
    process.exit(0);
  });
}

async function runQuery(input: string, contextFile?: string) {
  const orchestrator = await initOrchestrator();

  let context: string | undefined;
  if (contextFile) {
    try {
      context = await fs.readFile(contextFile, 'utf-8');
    } catch (error) {
      console.error(chalk.red(`Failed to read context file: ${contextFile}`));
      process.exit(1);
    }
  }

  try {
    const response = await orchestrator.process(input, context);

    console.log(chalk.white(response.content));
    console.log(chalk.gray(`\n[${response.model} | ${response.tokens} tokens | ${response.latency}ms]`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

async function showStats() {
  const orchestrator = await initOrchestrator();
  displayMetrics(orchestrator);
}

async function initOrchestrator(): Promise<AIOrchestrator> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY not set in .env file'));
    process.exit(1);
  }

  const configDir = path.join(__dirname, '../../config');
  const routingConfig: RoutingConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'routing.config.json'), 'utf-8')
  );
  const modelConfig: ModelConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'model.config.json'), 'utf-8')
  );

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey);
  await orchestrator.initialize();

  return orchestrator;
}

function displayMetrics(orchestrator: AIOrchestrator) {
  const metrics = orchestrator.getMetrics();
  const localRatio = metrics.totalRequests > 0
    ? (metrics.localRequests / metrics.totalRequests * 100).toFixed(1)
    : '0';

  console.log(chalk.cyan.bold('\n📊 Usage Statistics\n'));
  console.log(chalk.white(`Total Requests:    ${metrics.totalRequests}`));
  console.log(chalk.green(`Local Requests:    ${metrics.localRequests} (${localRatio}%)`));
  console.log(chalk.blue(`Claude Requests:   ${metrics.claudeRequests}`));
  console.log(chalk.yellow(`Tokens Saved:      ${metrics.tokensSaved.toLocaleString()}`));
  console.log(chalk.magenta(`Claude Tokens:     ${metrics.claudeTokensUsed.toLocaleString()}`));
  console.log(chalk.gray(`Avg Latency:       ${Math.round(metrics.avgLatency)}ms`));
  console.log();
}

function displayHelp() {
  console.log(chalk.cyan.bold('\n📖 Commands\n'));
  console.log(chalk.white('/stats  - Show usage statistics'));
  console.log(chalk.white('/reset  - Reset session and clear conversation history'));
  console.log(chalk.white('/help   - Show this help message'));
  console.log(chalk.white('/quit   - Exit the program'));
  console.log();
}
