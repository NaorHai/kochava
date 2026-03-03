#!/usr/bin/env node

/**
 * Kochava Smoke Test
 *
 * Quick sanity check (runs in <10 seconds)
 * Tests critical paths only:
 * - Computer-use route
 * - Local model execution
 * - Tool discovery
 *
 * Usage: node test/smoke-test.js
 */

import { AIOrchestrator } from '../dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m'
};

async function smokeTest() {
  console.log(`${colors.cyan}━━━ Kochava Smoke Test ━━━${colors.reset}\n`);

  // Load configs
  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  console.log(`${colors.gray}[1/4] Initializing...${colors.reset}`);
  const orchestrator = new AIOrchestrator(
    routingConfig,
    modelConfig,
    apiKey,
    bedrockUrl,
    'smoke-test'
  );

  await orchestrator.initialize();
  const toolCounts = await orchestrator.getToolCounts();
  console.log(`${colors.green}✓ Initialized${colors.reset} (${toolCounts.skills} skills, ${toolCounts.mcps} MCPs)\n`);

  // Test 1: Computer-use (bash)
  console.log(`${colors.gray}[2/4] Testing computer-use route...${colors.reset}`);
  const bashResult = await orchestrator.process('pwd');
  const bashPassed = bashResult.model.includes('computer_use') && bashResult.content.includes('/');

  if (bashPassed) {
    console.log(`${colors.green}✓ Computer-use works${colors.reset} (${bashResult.latency}ms)\n`);
  } else {
    console.log(`${colors.red}✗ Computer-use failed${colors.reset}`);
    console.log(`  Model: ${bashResult.model}`);
    console.log(`  Output: ${bashResult.content.substring(0, 100)}\n`);
    process.exit(1);
  }

  // Test 2: File operation (natural language)
  console.log(`${colors.gray}[3/4] Testing natural language file ops...${colors.reset}`);
  const fileResult = await orchestrator.process('list files in ~/Downloads');
  const filePassed = fileResult.model.includes('computer_use') && fileResult.content.length > 10;

  if (filePassed) {
    console.log(`${colors.green}✓ File operations work${colors.reset} (${fileResult.latency}ms)\n`);
  } else {
    console.log(`${colors.red}✗ File operations failed${colors.reset}`);
    console.log(`  Model: ${fileResult.model}`);
    console.log(`  Output: ${fileResult.content.substring(0, 100)}\n`);
    process.exit(1);
  }

  // Test 3: Local model
  console.log(`${colors.gray}[4/4] Testing local model execution...${colors.reset}`);
  const localResult = await orchestrator.process('what is 2+2?');
  const localPassed = !localResult.model.includes('claude') && localResult.content.length > 0;

  if (localPassed) {
    console.log(`${colors.green}✓ Local model works${colors.reset} (${localResult.model}, ${localResult.latency}ms)\n`);
  } else {
    console.log(`${colors.red}✗ Local model failed${colors.reset}`);
    console.log(`  Model: ${localResult.model}`);
    console.log(`  Output: ${localResult.content.substring(0, 100)}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}  ✓ All smoke tests passed!${colors.reset}`);
  console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  process.exit(0);
}

smokeTest().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
