#!/usr/bin/env node

import express from 'express';
import { AIOrchestrator } from '../core/orchestrator.js';
import { RoutingConfig, ModelConfig } from '../types/index.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

let orchestrator: AIOrchestrator;

async function initOrchestrator() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const configDir = path.join(__dirname, '../../config');
  const routingConfig: RoutingConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'routing.config.json'), 'utf-8')
  );
  const modelConfig: ModelConfig = JSON.parse(
    await fs.readFile(path.join(configDir, 'model.config.json'), 'utf-8')
  );

  orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey);
  await orchestrator.initialize();

  logger.info('AI Orchestrator initialized for plugin mode');
}

app.post('/route', async (req, res) => {
  try {
    const { query, code_context } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query'
      });
    }

    logger.info('Plugin request received', {
      queryLength: query.length,
      hasContext: !!code_context
    });

    const response = await orchestrator.process(query, code_context);

    res.json({
      response: response.content,
      model_used: response.model,
      tokens_used: response.tokens,
      latency_ms: response.latency,
      metrics: orchestrator.getMetrics()
    });
  } catch (error: any) {
    logger.error('Plugin request failed', { error: error.message });
    res.status(500).json({
      error: error.message
    });
  }
});

app.get('/.well-known/ai-plugin.json', async (req, res) => {
  const manifest = {
    schema_version: 'v1',
    name_for_human: 'AI Router',
    name_for_model: 'ai_router',
    description_for_human: 'Routes AI requests between local models and Claude API for optimal performance',
    description_for_model: 'Routes coding requests to local SLMs or Claude based on complexity. Minimizes token usage.',
    auth: {
      type: 'none'
    },
    api: {
      type: 'openapi',
      url: `http://localhost:${PORT}/openapi.yaml`
    },
    logo_url: 'http://localhost:3001/logo.png',
    contact_email: 'support@example.com',
    legal_info_url: 'http://localhost:3001/legal'
  };

  res.json(manifest);
});

app.get('/openapi.yaml', async (req, res) => {
  const openapiPath = path.join(__dirname, '../../plugin/openapi.yaml');
  const content = await fs.readFile(openapiPath, 'utf-8');
  res.type('text/yaml').send(content);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'plugin'
  });
});

const PORT = parseInt(process.env.PLUGIN_PORT || '3001', 10);

async function start() {
  try {
    await initOrchestrator();

    app.listen(PORT, () => {
      console.log(`🔌 AI Router Plugin running on http://localhost:${PORT}`);
      console.log(`   POST /route                      - Route AI request`);
      console.log(`   GET  /.well-known/ai-plugin.json - Plugin manifest`);
      console.log(`   GET  /openapi.yaml               - OpenAPI spec`);
      console.log(`   GET  /health                     - Health check`);
      console.log(`\nTo use as Claude plugin, add this URL to Claude Desktop:`);
      console.log(`   http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start plugin server:', error);
    process.exit(1);
  }
}

start();
