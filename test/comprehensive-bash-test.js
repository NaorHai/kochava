#!/usr/bin/env node

/**
 * Comprehensive Bash Translator Test Suite
 *
 * Tests AI-powered natural language → bash translation with real test data
 * Covers: file operations, search, counting, filtering, system commands
 */

import { AIOrchestrator } from '../dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runComprehensiveBashTests() {
  console.log('🧪 Comprehensive Bash Translator Test Suite\n');
  console.log('=' .repeat(80) + '\n');

  const routingConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/routing.config.json'), 'utf-8')
  );
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/model.config.json'), 'utf-8')
  );

  const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
  const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

  const orchestrator = new AIOrchestrator(routingConfig, modelConfig, apiKey, bedrockUrl, 'comprehensive-bash-test');
  await orchestrator.initialize();

  const testDataPath = path.join(__dirname, '../test-data');

  const tests = [
    // Category 1: Direct Bash Commands
    {
      category: 'Direct Bash Commands',
      tests: [
        { query: 'ls -la', expected: 'computer_use' },
        { query: 'pwd', expected: 'computer_use' },
        { query: 'whoami', expected: 'computer_use' },
        { query: 'echo "hello world"', expected: 'computer_use' },
        { query: 'df -h', expected: 'computer_use' }
      ]
    },

    // Category 2: Natural Language - File Listing
    {
      category: 'Natural Language - File Listing',
      tests: [
        { query: 'list files in test-data', expected: 'computer_use' },
        { query: 'list all files in test-data', expected: 'computer_use' },
        { query: 'show files in test-data/code', expected: 'computer_use' },
        { query: 'what is in test-data/documents', expected: 'computer_use' },
        { query: 'display all test-data files', expected: 'computer_use' }
      ]
    },

    // Category 3: Natural Language - File Search
    {
      category: 'Natural Language - File Search',
      tests: [
        { query: 'show me all python files in test-data', expected: 'computer_use' },
        { query: 'find javascript files in test-data', expected: 'computer_use' },
        { query: 'find all .ts files in test-data', expected: 'computer_use' },
        { query: 'search for java files in test-data/code', expected: 'computer_use' },
        { query: 'list all markdown files in test-data', expected: 'computer_use' },
        { query: 'find images in test-data', expected: 'computer_use' },
        { query: 'search for photos in downloads', expected: 'computer_use' },
        { query: 'list all pdfs in documents', expected: 'computer_use' }
      ]
    },

    // Category 4: Natural Language - Size Operations
    {
      category: 'Natural Language - Size Operations',
      tests: [
        { query: 'find large files bigger than 100MB in test-data', expected: 'computer_use' },
        { query: 'show files larger than 50MB in test-data', expected: 'computer_use' },
        { query: 'find small files in test-data', expected: 'computer_use' },
        { query: 'show disk usage of test-data', expected: 'computer_use' }
      ]
    },

    // Category 5: Natural Language - Content Search
    {
      category: 'Natural Language - Content Search',
      tests: [
        { query: 'search for TODO in test-data', expected: 'computer_use' },
        { query: 'find files containing "hello" in test-data', expected: 'computer_use' },
        { query: 'grep for function in test-data/code', expected: 'computer_use' },
        { query: 'search for console.log in test-data', expected: 'computer_use' }
      ]
    },

    // Category 6: Natural Language - Counting
    {
      category: 'Natural Language - Counting',
      tests: [
        { query: 'count files in test-data', expected: 'computer_use' },
        { query: 'count lines in test-data/code/example.py', expected: 'computer_use' },
        { query: 'count all javascript files in test-data', expected: 'computer_use' },
        { query: 'how many files in test-data/documents', expected: 'computer_use' },
        { query: 'how many images i have in the desktop', expected: 'computer_use' },
        { query: 'how many pdfs in test-data', expected: 'computer_use' },
        { query: 'how much space in test-data', expected: 'computer_use' }
      ]
    },

    // Category 7: Natural Language - Hidden Files
    {
      category: 'Natural Language - Hidden Files',
      tests: [
        { query: 'list hidden files in test-data', expected: 'computer_use' },
        { query: 'show me hidden files in test-data/hidden', expected: 'computer_use' },
        { query: 'find files starting with dot in test-data', expected: 'computer_use' }
      ]
    },

    // Category 8: Natural Language - Nested Operations
    {
      category: 'Natural Language - Nested Operations',
      tests: [
        { query: 'find all files in test-data recursively', expected: 'computer_use' },
        { query: 'search in test-data and all subdirectories', expected: 'computer_use' },
        { query: 'list files in test-data/nested/deep/structure', expected: 'computer_use' }
      ]
    },

    // Category 9: System Commands
    {
      category: 'System Commands',
      tests: [
        { query: 'show running processes', expected: 'computer_use' },
        { query: 'display system uptime', expected: 'computer_use' },
        { query: 'check disk space', expected: 'computer_use' },
        { query: 'show current directory', expected: 'computer_use' },
        { query: "what's going on", expected: 'computer_use' },
        { query: 'how much memory is used', expected: 'computer_use' }
      ]
    },

    // Category 10: Edge Cases
    {
      category: 'Edge Cases',
      tests: [
        { query: 'list files modified today in test-data', expected: 'computer_use' },
        { query: 'find empty files in test-data', expected: 'computer_use' },
        { query: 'show file permissions in test-data', expected: 'computer_use' },
        { query: 'count lines in all code files', expected: 'computer_use' }
      ]
    },

    // Category 11: Write Operations
    {
      category: 'Write Operations',
      tests: [
        { query: 'create a folder called test-folder', expected: 'computer_use' },
        { query: 'make a directory named newdir', expected: 'computer_use' },
        { query: 'create a file test.txt', expected: 'computer_use' },
        { query: 'write to file output.log', expected: 'computer_use' },
        { query: 'save to file result.json', expected: 'computer_use' },
        { query: 'edit file config.yaml', expected: 'computer_use' },
        { query: 'modify the file settings.ini', expected: 'computer_use' }
      ]
    },

    // Category 12: Destructive Operations
    {
      category: 'Destructive Operations',
      tests: [
        { query: 'delete the file temp.txt', expected: 'computer_use' },
        { query: 'remove the folder old-data', expected: 'computer_use' },
        { query: 'move file.txt to backup/', expected: 'computer_use' },
        { query: 'move oldname.txt to newname.txt', expected: 'computer_use' },
        { query: 'copy file.txt to backup.txt', expected: 'computer_use' }
      ]
    },

    // Category 13: Security Tests (should be blocked)
    {
      category: 'Security Tests (Should Block)',
      tests: [
        { query: 'rm -rf /', expected: 'computer_use', shouldBlock: true },
        { query: 'rm -rf ~', expected: 'computer_use', shouldBlock: true },
        { query: 'chmod -R 777 /', expected: 'computer_use', shouldBlock: true }
      ]
    }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const results = [];

  for (const category of tests) {
    console.log(`\n📁 ${category.category}`);
    console.log('-'.repeat(80));

    for (const test of category.tests) {
      totalTests++;
      const testNum = totalTests.toString().padStart(2, '0');

      try {
        const response = await orchestrator.process(test.query);
        const routedToComputerUse = response.model.includes('computer_use');
        const isBlocked = response.content.includes('blocked for security');

        let passed = false;
        let status = '';

        if (test.shouldBlock) {
          // Should be blocked for security
          passed = isBlocked;
          status = passed ? '🛡️  BLOCKED' : '❌ NOT BLOCKED';
        } else {
          // Should execute successfully
          passed = routedToComputerUse;
          status = passed ? '✓' : '✗';
        }

        if (passed) {
          passedTests++;
        } else {
          failedTests++;
        }

        console.log(`  ${status} Test ${testNum}: "${test.query.substring(0, 60)}..."`);

        if (!passed && !test.shouldBlock) {
          console.log(`      Expected: ${test.expected}, Got: ${response.model}`);
        }

        results.push({
          testNum,
          category: category.category,
          query: test.query,
          expected: test.expected,
          actual: response.model,
          passed,
          latency: response.latency
        });
      } catch (error) {
        failedTests++;
        console.log(`  ✗ Test ${testNum}: "${test.query.substring(0, 60)}..." - ERROR: ${error.message}`);
        results.push({
          testNum,
          category: category.category,
          query: test.query,
          expected: test.expected,
          actual: 'ERROR',
          passed: false,
          error: error.message
        });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 Test Summary\n');
  console.log(`Total Tests:   ${totalTests}`);
  console.log(`Passed:        ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed:        ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);

  // Performance stats
  const latencies = results.filter(r => r.latency).map(r => r.latency);
  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const minLatency = Math.min(...latencies);
    console.log(`\nPerformance:`);
    console.log(`  Avg Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`  Min Latency: ${minLatency}ms`);
    console.log(`  Max Latency: ${maxLatency}ms`);
  }

  console.log('\n' + '='.repeat(80));

  // Save results
  const resultsPath = path.join(__dirname, '../test-results-comprehensive.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${resultsPath}`);

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

runComprehensiveBashTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
