#!/usr/bin/env node

/**
 * Test write/destructive operations routing
 *
 * Verifies that commands like "create folder", "delete file", "write to"
 * are correctly routed to computer_use for execution
 */

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWriteOperations() {
  console.log('Testing write/destructive operations routing:\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-write-ops');
  await orchestrator.initialize();

  const tests = [
    'create a folder called test-folder',
    'make a file test.txt',
    'write to file output.log',
    'delete the file temp.txt',
    'remove the folder old-data',
    'move file.txt to backup/',
    'copy file.txt to backup.txt',
    'edit file config.yaml',
    'save data to output.json'
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const response = await orchestrator.process(test);
    const isComputerUse = response.model.includes('computer_use');

    if (isComputerUse) {
      console.log(`✓ "${test}" → ${response.model}`);
      passed++;
    } else {
      console.log(`✗ "${test}" → ${response.model} (expected computer_use)`);
      failed++;
    }
  }

  console.log(`\n${passed}/${tests.length} tests passed`);

  if (failed > 0) {
    console.log('\n❌ Some write operations not routed to computer_use');
    process.exit(1);
  } else {
    console.log('\n✅ All write operations correctly routed to computer_use');
    process.exit(0);
  }
}

testWriteOperations().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
