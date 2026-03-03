#!/usr/bin/env node

/**
 * Test conversation context expansion
 * Simulates: User asks about images on desktop, then asks "what are their names"
 */

import { AIOrchestrator } from './dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testContextExpansion() {
  console.log('🧪 Testing Conversation Context Expansion\n');
  console.log('=' .repeat(80) + '\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(
    routingConfig,
    modelConfig,
    apiKey,
    bedrockUrl,
    'test-context'
  );

  await orchestrator.initialize();

  // Simulate conversation
  console.log('👤 User: "how many images i have in the desktop"');
  const r1 = await orchestrator.process('how many images i have in the desktop');
  console.log(`🤖 Assistant: ${r1.content}`);
  console.log(`   Model: ${r1.model}`);
  console.log('');

  // Now ask vague follow-up
  console.log('👤 User: "what are their names"');
  console.log('   (Will be expanded with context from previous message)');
  const r2 = await orchestrator.process('what are their names');

  // Show actual output
  const lines = r2.content.split('\n');
  if (lines.length <= 10) {
    console.log(`🤖 Assistant: ${r2.content}`);
  } else {
    console.log(`🤖 Assistant:\n${lines.slice(0, 10).join('\n')}\n   ...and ${lines.length - 10} more`);
  }
  console.log(`   Model: ${r2.model}`);
  console.log('');

  // Verify it worked
  if (r2.model.includes('computer_use')) {
    console.log('✅ SUCCESS: Context expansion working!');
    console.log('   "what are their names" was expanded to include desktop/images context');
  } else {
    console.log('❌ FAILURE: Still routing to local model instead of computer_use');
  }
}

testContextExpansion().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
