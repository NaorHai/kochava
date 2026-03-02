import { AIOrchestrator } from '../core/orchestrator.js';
import { RoutingConfig, ModelConfig } from '../types/index.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function verify() {
  console.log('🧪 Running TypeScript verification tests...\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<boolean>) {
    try {
      console.log(`Testing: ${name}`);
      const result = await fn();
      if (result) {
        console.log('  ✓ PASS\n');
        passed++;
      } else {
        console.log('  ✗ FAIL\n');
        failed++;
      }
    } catch (error: any) {
      console.log(`  ✗ FAIL: ${error.message}\n`);
      failed++;
    }
  }

  await test('Configuration files exist', async () => {
    const configDir = path.join(__dirname, '../../config');
    const routingExists = await fs.access(path.join(configDir, 'routing.config.json')).then(() => true).catch(() => false);
    const modelExists = await fs.access(path.join(configDir, 'model.config.json')).then(() => true).catch(() => false);
    return routingExists && modelExists;
  });

  await test('Configuration files are valid JSON', async () => {
    const configDir = path.join(__dirname, '../../config');
    const routingConfig = JSON.parse(await fs.readFile(path.join(configDir, 'routing.config.json'), 'utf-8'));
    const modelConfig = JSON.parse(await fs.readFile(path.join(configDir, 'model.config.json'), 'utf-8'));
    return routingConfig && modelConfig;
  });

  await test('Environment file exists', async () => {
    return await fs.access(path.join(__dirname, '../../.env')).then(() => true).catch(() => false);
  });

  await test('Orchestrator can be instantiated', async () => {
    const configDir = path.join(__dirname, '../../config');
    const routingConfig: RoutingConfig = JSON.parse(
      await fs.readFile(path.join(configDir, 'routing.config.json'), 'utf-8')
    );
    const modelConfig: ModelConfig = JSON.parse(
      await fs.readFile(path.join(configDir, 'model.config.json'), 'utf-8')
    );

    const apiKey = process.env.ANTHROPIC_API_KEY || 'test-key';
    const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey);

    return orchestrator !== null;
  });

  await test('Log directory exists', async () => {
    const logDir = path.join(__dirname, '../../logs');
    return await fs.access(logDir).then(() => true).catch(() => false);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) {
    process.exit(1);
  }
}

verify();
