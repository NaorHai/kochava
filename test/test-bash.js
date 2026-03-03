#!/usr/bin/env node

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  console.log('Loading configurations...');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );

  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  console.log('Initializing orchestrator...');
  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-session');

  await orchestrator.initialize();

  console.log('✓ Ready!\n');

  // Test bash commands
  const tests = [
    'ls ~/Downloads',
    'pwd',
    "what's in ~/Source",
    'list files in ~/Documents'
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${test}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const response = await orchestrator.process(test);
      console.log(`Model: ${response.model}`);
      console.log(`Latency: ${response.latency}ms`);
      console.log(`Output:`);
      console.log(response.content);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

test().catch(console.error);
