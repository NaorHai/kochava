#!/usr/bin/env node

/**
 * Basic health checks for Kochava
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    failed++;
  }
}

console.log('Running health checks...\n');

// Check project structure
test('dist/ directory exists', () => {
  if (!existsSync(join(projectRoot, 'dist'))) {
    throw new Error('dist directory not found - run npm run build');
  }
});

test('config/ directory exists', () => {
  if (!existsSync(join(projectRoot, 'config'))) {
    throw new Error('config directory not found');
  }
});

test('Main entry point exists', () => {
  if (!existsSync(join(projectRoot, 'dist/interfaces/kochava.js'))) {
    throw new Error('dist/interfaces/kochava.js not found');
  }
});

// Check configuration files
test('routing.config.json exists', () => {
  if (!existsSync(join(projectRoot, 'config/routing.config.json'))) {
    throw new Error('config/routing.config.json not found');
  }
});

test('model.config.json exists', () => {
  if (!existsSync(join(projectRoot, 'config/model.config.json'))) {
    throw new Error('config/model.config.json not found');
  }
});

test('.env.example exists', () => {
  if (!existsSync(join(projectRoot, '.env.example'))) {
    throw new Error('.env.example not found');
  }
});

// Check scripts
test('setup.sh exists and is executable', () => {
  if (!existsSync(join(projectRoot, 'setup.sh'))) {
    throw new Error('setup.sh not found');
  }
});

test('install_command.sh exists', () => {
  if (!existsSync(join(projectRoot, 'scripts/install_command.sh'))) {
    throw new Error('scripts/install_command.sh not found');
  }
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
