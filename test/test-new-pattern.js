#!/usr/bin/env node

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testNewPattern() {
  console.log('Testing new pattern: "list all downloads files"\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-new');
  await orchestrator.initialize();

  const tests = [
    'list all downloads files',
    'list downloads files',
    'show documents files',
    'list source files'
  ];

  for (const test of tests) {
    console.log(`\nTest: "${test}"`);
    const response = await orchestrator.process(test);

    if (response.model.includes('computer_use')) {
      console.log(`✅ PASS - ${response.model} (${response.latency}ms)`);
      console.log(`   Output: ${response.content.substring(0, 150)}...`);
    } else {
      console.log(`❌ FAIL - Routed to: ${response.model}`);
      console.log(`   Output: ${response.content.substring(0, 150)}...`);
    }
  }
}

testNewPattern().catch(console.error);
