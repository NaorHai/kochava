#!/usr/bin/env node

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testUserCommand() {
  console.log('Testing: "list all files in Downloads"\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'test-user');
  await orchestrator.initialize();

  const response = await orchestrator.process('list all files in Downloads');

  console.log(`Model: ${response.model}`);
  console.log(`Latency: ${response.latency}ms`);
  console.log(`\nOutput (first 500 chars):`);
  console.log(response.content.substring(0, 500));

  if (response.model.includes('computer_use')) {
    console.log('\n✅ SUCCESS - Routed to computer_use and executed bash command!');
  } else {
    console.log('\n❌ FAIL - Did not route to computer_use');
  }
}

testUserCommand().catch(console.error);
