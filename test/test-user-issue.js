#!/usr/bin/env node

/**
 * Test for user-reported issue:
 * "how many images i have in the desktop" should route to computer_use, not local model
 */

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testUserIssue() {
  console.log('Testing user-reported issue fix:\n');
  console.log('Query: "how many images i have in the desktop"');
  console.log('Expected: Should route to computer_use (not local model)\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-user-issue');
  await orchestrator.initialize();

  console.log('Testing...\n');

  const response = await orchestrator.process('how many images i have in the desktop');

  console.log(`Model: ${response.model}`);
  console.log(`Latency: ${response.latency}ms`);
  console.log(`Output: ${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}\n`);

  if (response.model.includes('computer_use')) {
    console.log('✅ SUCCESS: Query correctly routed to computer_use');
    console.log('The bash command will be executed directly (no hallucination)\n');
    process.exit(0);
  } else {
    console.log('❌ FAILURE: Query routed to local model instead of computer_use');
    console.log('This causes hallucination instead of actual execution\n');
    process.exit(1);
  }
}

testUserIssue().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
