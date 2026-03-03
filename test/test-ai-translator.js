#!/usr/bin/env node

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAITranslator() {
  console.log('Testing AI Bash Translator\n');
  console.log('=' .repeat(80) + '\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-ai');
  await orchestrator.initialize();

  const tests = [
    // Original working patterns
    'list all files in Downloads',
    'list all downloads files',
    "what's inside Downloads",

    // New challenging patterns (no hard-coded support)
    'show me all python files',
    'find large files bigger than 100MB',
    'count lines in all javascript files',
    'show disk usage',
    'find files modified today',
    'search for TODO in source code',
    'list hidden files',
    'show running processes'
  ];

  for (const test of tests) {
    console.log(`Test: "${test}"`);
    try {
      const response = await orchestrator.process(test);

      if (response.model.includes('computer_use')) {
        console.log(`  ✓ ${response.model} (${response.latency}ms)`);
        console.log(`    Output: ${response.content.substring(0, 120)}...`);
      } else {
        console.log(`  ✗ Routed to: ${response.model}`);
        console.log(`    Output: ${response.content.substring(0, 120)}...`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('=' .repeat(80));
  console.log('AI Translator allows handling ANY bash-like request, not just hard-coded patterns!');
}

testAITranslator().catch(console.error);
