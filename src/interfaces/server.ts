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

  logger.info('AI Orchestrator initialized for server mode');
}

app.post('/api/process', async (req, res) => {
  try {
    const { input, context } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Missing input field' });
    }

    const response = await orchestrator.process(input, context);

    res.json({
      success: true,
      response: {
        content: response.content,
        model: response.model,
        tokens: response.tokens,
        latency: response.latency
      }
    });
  } catch (error: any) {
    logger.error('Request processing failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/index', async (req, res) => {
  try {
    const { files } = req.body;

    if (!Array.isArray(files)) {
      return res.status(400).json({ error: 'files must be an array' });
    }

    await orchestrator.indexCodebase(files);

    res.json({
      success: true,
      message: `Indexed ${files.length} files`
    });
  } catch (error: any) {
    logger.error('Indexing failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = orchestrator.getMetrics();

    res.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    logger.error('Failed to get metrics', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    orchestrator.resetSession();

    res.json({
      success: true,
      message: 'Session reset'
    });
  } catch (error: any) {
    logger.error('Reset failed', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

async function start() {
  try {
    await initOrchestrator();

    app.listen(PORT, () => {
      console.log(`🚀 AI Router Server running on http://localhost:${PORT}`);
      console.log(`   POST /api/process - Process a query`);
      console.log(`   POST /api/index   - Index codebase`);
      console.log(`   GET  /api/metrics - Get usage metrics`);
      console.log(`   POST /api/reset   - Reset session`);
      console.log(`   GET  /health      - Health check`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
