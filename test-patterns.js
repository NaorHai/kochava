#!/usr/bin/env node

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPatterns() {
  console.log('Testing pattern matching improvements...\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-patterns');
  await orchestrator.initialize();

  const tests = [
    'list all files in Downloads',
    'list files in Downloads',
    'list the files in Documents',
    'show all files in Source',
    "what's inside Downloads",
    'show directory Documents',
    'count files in Downloads'
  ];

  for (const test of tests) {
    console.log(`Test: "${test}"`);
    try {
      const response = await orchestrator.process(test);
      console.log(`✓ ${response.model} (${response.latency}ms)`);
      if (response.content.length > 200) {
        console.log(`  Output: ${response.content.substring(0, 200)}...`);
      } else {
        console.log(`  Output: ${response.content}`);
      }
    } catch (error) {
      console.log(`✗ Error: ${error.message}`);
    }
    console.log('');
  }
}

testPatterns().catch(console.error);
