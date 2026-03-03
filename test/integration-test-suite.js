#!/usr/bin/env node

/**
 * Kochava Integration Test Suite
 *
 * Comprehensive testing for all routing paths and execution modes:
 * - Computer-use (bash commands)
 * - File operations (natural language)
 * - Skills invocation
 * - MCP tools
 * - Local model execution
 * - Claude escalation
 * - Error handling
 *
 * Usage: node test/integration-test-suite.js
 */

import { AIOrchestrator } from '../dist/core/orchestrator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

class TestRunner {
  constructor() {
    this.orchestrator = null;
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
    this.startTime = 0;
  }

  async initialize() {
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}Kochava Integration Test Suite${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

    console.log(`${colors.gray}Loading configurations...${colors.reset}`);

    const routingConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../config/routing.config.json'), 'utf-8')
    );

    const modelConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../config/model.config.json'), 'utf-8')
    );

    const apiKey = process.env.ANTHROPIC_API_KEY || 'sk-test';
    const bedrockUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;

    console.log(`${colors.gray}Initializing orchestrator...${colors.reset}`);
    this.orchestrator = new AIOrchestrator(
      routingConfig,
      modelConfig,
      apiKey,
      bedrockUrl,
      'test-integration-suite'
    );

    await this.orchestrator.initialize();

    const toolCounts = await this.orchestrator.getToolCounts();
    console.log(`${colors.green}✓ Ready!${colors.reset} ${toolCounts.skills} skills + ${toolCounts.mcps} MCPs loaded\n`);
  }

  async runTest(category, name, input, assertions) {
    this.totalTests++;
    const testNum = this.totalTests;

    console.log(`${colors.blue}[${testNum}]${colors.reset} ${category} → ${name}`);
    console.log(`${colors.gray}  Input: "${input.substring(0, 80)}${input.length > 80 ? '...' : ''}"${colors.reset}`);

    try {
      const startTime = Date.now();
      const response = await this.orchestrator.process(input);
      const duration = Date.now() - startTime;

      // Run assertions
      const assertionResults = await assertions(response);

      if (assertionResults.passed) {
        this.passedTests++;
        console.log(`${colors.green}  ✓ PASS${colors.reset} (${duration}ms) - ${response.model}`);

        this.results.push({
          category,
          name,
          status: 'PASS',
          duration,
          model: response.model,
          details: assertionResults.message
        });
      } else {
        this.failedTests++;
        console.log(`${colors.red}  ✗ FAIL${colors.reset} - ${assertionResults.message}`);
        console.log(`${colors.gray}    Response: ${response.content.substring(0, 200)}${colors.reset}`);

        this.results.push({
          category,
          name,
          status: 'FAIL',
          duration,
          model: response.model,
          details: assertionResults.message,
          output: response.content.substring(0, 500)
        });
      }
    } catch (error) {
      this.failedTests++;
      console.log(`${colors.red}  ✗ ERROR${colors.reset} - ${error.message}`);

      this.results.push({
        category,
        name,
        status: 'ERROR',
        error: error.message
      });
    }

    console.log('');
  }

  async runTestSuite() {
    this.startTime = Date.now();

    // ========================================
    // Category 1: Computer-Use (Bash Commands)
    // ========================================
    console.log(`${colors.cyan}━━━ Computer-Use: Bash Commands ━━━${colors.reset}\n`);

    await this.runTest(
      'Computer-Use',
      'Direct bash command (ls)',
      'ls ~/Downloads',
      async (response) => {
        const hasFiles = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');
        const isFast = response.latency < 500;

        return {
          passed: hasFiles && isComputerUse && isFast,
          message: `Files listed: ${hasFiles}, Model: ${response.model}, Latency: ${response.latency}ms`
        };
      }
    );

    await this.runTest(
      'Computer-Use',
      'Current directory (pwd)',
      'pwd',
      async (response) => {
        const hasPath = response.content.includes('/');
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasPath && isComputerUse,
          message: `Path returned: ${hasPath}, Model: ${response.model}`
        };
      }
    );

    await this.runTest(
      'Computer-Use',
      'Find files with pattern',
      'find ~/Documents/Private/kochava -name "*.json" -maxdepth 2',
      async (response) => {
        const hasResults = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasResults && isComputerUse,
          message: `Results found: ${hasResults}, Model: ${response.model}`
        };
      }
    );

    // ========================================
    // Category 2: File Operations (Natural Language)
    // ========================================
    console.log(`${colors.cyan}━━━ Computer-Use: Natural Language File Operations ━━━${colors.reset}\n`);

    await this.runTest(
      'File-Operations',
      'Natural language: list files',
      "what's in ~/Downloads",
      async (response) => {
        const hasFiles = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasFiles && isComputerUse,
          message: `Files listed: ${hasFiles}, Routed to: ${response.model}`
        };
      }
    );

    await this.runTest(
      'File-Operations',
      'Natural language: show directory',
      'list files in ~/Documents',
      async (response) => {
        const hasContent = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasContent && isComputerUse,
          message: `Content shown: ${hasContent}, Model: ${response.model}`
        };
      }
    );

    await this.runTest(
      'File-Operations',
      'Natural language: list all files (with modifier)',
      'list all files in Downloads',
      async (response) => {
        const hasFiles = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');
        const isFast = response.latency < 200;

        return {
          passed: hasFiles && isComputerUse && isFast,
          message: `Files listed: ${hasFiles}, Computer-use: ${isComputerUse}, Latency: ${response.latency}ms`
        };
      }
    );

    await this.runTest(
      'File-Operations',
      'Natural language: what\'s inside',
      "what's inside Downloads",
      async (response) => {
        const hasContent = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasContent && isComputerUse,
          message: `Content shown: ${hasContent}, Model: ${response.model}`
        };
      }
    );

    await this.runTest(
      'File-Operations',
      'Natural language: show directory',
      'show directory Documents',
      async (response) => {
        const hasContent = response.content.length > 10;
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasContent && isComputerUse,
          message: `Directory shown: ${hasContent}, Model: ${response.model}`
        };
      }
    );

    await this.runTest(
      'File-Operations',
      'Natural language: count files',
      'count files in Downloads',
      async (response) => {
        const hasNumber = /\d+/.test(response.content);
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: hasNumber && isComputerUse,
          message: `Count shown: ${hasNumber}, Model: ${response.model}`
        };
      }
    );

    // ========================================
    // Category 3: Skills Invocation
    // ========================================
    console.log(`${colors.cyan}━━━ Skills Invocation ━━━${colors.reset}\n`);

    await this.runTest(
      'Skills',
      'Budget skill',
      '/budget',
      async (response) => {
        const hasResponse = response.content.length > 0;
        const isLocal = !response.model.includes('claude');

        return {
          passed: hasResponse && isLocal,
          message: `Response generated: ${hasResponse}, Local execution: ${isLocal}`
        };
      }
    );

    // ========================================
    // Category 4: Local Model Tasks
    // ========================================
    console.log(`${colors.cyan}━━━ Local Model Execution ━━━${colors.reset}\n`);

    await this.runTest(
      'Local-Code',
      'Simple code formatting',
      'format this: function foo(){return 1}',
      async (response) => {
        const hasFormatted = response.content.includes('function') || response.content.includes('foo');
        const isLocal = response.model.includes('local') || response.model.includes('qwen') || response.model.includes('llama');

        return {
          passed: hasFormatted && isLocal,
          message: `Formatted: ${hasFormatted}, Local: ${isLocal}`
        };
      }
    );

    await this.runTest(
      'Local-General',
      'Simple question',
      'what is javascript?',
      async (response) => {
        const hasAnswer = response.content.length > 50;
        const isLocal = response.model.includes('local') || response.model.includes('qwen') || response.model.includes('llama');

        return {
          passed: hasAnswer && isLocal,
          message: `Answer provided: ${hasAnswer}, Local: ${isLocal}`
        };
      }
    );

    await this.runTest(
      'Local-Compress',
      'Explanation request',
      'explain what async/await does in JavaScript',
      async (response) => {
        const hasExplanation = response.content.length > 100;
        const mentionsAsync = response.content.toLowerCase().includes('async') ||
                              response.content.toLowerCase().includes('promise');
        const isLocal = response.model.includes('local') || response.model.includes('qwen') || response.model.includes('llama');

        return {
          passed: hasExplanation && mentionsAsync && isLocal,
          message: `Explained: ${hasExplanation}, Relevant: ${mentionsAsync}, Local: ${isLocal}`
        };
      }
    );

    // ========================================
    // Category 5: Routing Logic
    // ========================================
    console.log(`${colors.cyan}━━━ Routing & Escalation ━━━${colors.reset}\n`);

    await this.runTest(
      'Routing',
      'Simple task stays local',
      'rename variable x to y',
      async (response) => {
        const isLocal = !response.model.includes('claude');

        return {
          passed: isLocal,
          message: `Stayed local: ${isLocal}, Model: ${response.model}`
        };
      }
    );

    // ========================================
    // Category 6: Error Handling
    // ========================================
    console.log(`${colors.cyan}━━━ Error Handling ━━━${colors.reset}\n`);

    await this.runTest(
      'Error-Handling',
      'Invalid bash command',
      'invalidcommandxyz123',
      async (response) => {
        const hasError = response.content.toLowerCase().includes('error') ||
                        response.content.toLowerCase().includes('not found') ||
                        response.content.toLowerCase().includes('command');

        return {
          passed: hasError,
          message: `Error message shown: ${hasError}`
        };
      }
    );

    await this.runTest(
      'Error-Handling',
      'Dangerous command blocked',
      'rm -rf /',
      async (response) => {
        const isBlocked = response.content.toLowerCase().includes('blocked') ||
                         response.content.toLowerCase().includes('security') ||
                         response.content.toLowerCase().includes('dangerous');

        return {
          passed: isBlocked,
          message: `Command blocked: ${isBlocked}`
        };
      }
    );

    // ========================================
    // Category 7: Performance
    // ========================================
    console.log(`${colors.cyan}━━━ Performance Benchmarks ━━━${colors.reset}\n`);

    await this.runTest(
      'Performance',
      'Computer-use should be fast (<100ms)',
      'ls ~',
      async (response) => {
        const isFast = response.latency < 100;
        const isComputerUse = response.model.includes('computer_use');

        return {
          passed: isFast && isComputerUse,
          message: `Latency: ${response.latency}ms (target: <100ms)`
        };
      }
    );

    await this.runTest(
      'Performance',
      'Local model should be reasonable (<5s)',
      'what is 2+2?',
      async (response) => {
        const isReasonable = response.latency < 5000;
        const hasAnswer = response.content.length > 0;

        return {
          passed: isReasonable && hasAnswer,
          message: `Latency: ${response.latency}ms (target: <5s)`
        };
      }
    );

    // Print summary
    this.printSummary();
  }

  printSummary() {
    const totalDuration = Date.now() - this.startTime;

    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}Test Summary${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

    console.log(`Total Tests:    ${this.totalTests}`);
    console.log(`${colors.green}✓ Passed:${colors.reset}       ${this.passedTests}`);
    console.log(`${colors.red}✗ Failed:${colors.reset}       ${this.failedTests}`);
    console.log(`${colors.yellow}⊘ Skipped:${colors.reset}      ${this.skippedTests}`);
    console.log(`Total Duration: ${totalDuration}ms\n`);

    const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);

    if (this.failedTests === 0) {
      console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.green}  ✓ ALL TESTS PASSED (${successRate}% success rate)${colors.reset}`);
      console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    } else {
      console.log(`${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.red}  ✗ SOME TESTS FAILED (${successRate}% success rate)${colors.reset}`);
      console.log(`${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

      console.log(`${colors.red}Failed Tests:${colors.reset}`);
      this.results
        .filter(r => r.status !== 'PASS')
        .forEach((result, idx) => {
          console.log(`  ${idx + 1}. [${result.category}] ${result.name}`);
          console.log(`     ${colors.gray}${result.details || result.error}${colors.reset}`);
          if (result.output) {
            console.log(`     ${colors.gray}Output: ${result.output.substring(0, 100)}...${colors.reset}`);
          }
        });
      console.log('');
    }

    // Category breakdown
    console.log(`${colors.cyan}Results by Category:${colors.reset}`);
    const byCategory = {};
    this.results.forEach(r => {
      if (!byCategory[r.category]) {
        byCategory[r.category] = { passed: 0, failed: 0 };
      }
      if (r.status === 'PASS') {
        byCategory[r.category].passed++;
      } else {
        byCategory[r.category].failed++;
      }
    });

    Object.entries(byCategory).forEach(([cat, stats]) => {
      const total = stats.passed + stats.failed;
      const rate = ((stats.passed / total) * 100).toFixed(0);
      const color = stats.failed === 0 ? colors.green : colors.yellow;
      console.log(`  ${color}${cat}:${colors.reset} ${stats.passed}/${total} (${rate}%)`);
    });

    console.log('');

    // Save results to file
    const reportPath = path.join(__dirname, '../test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        skipped: this.skippedTests,
        successRate: successRate,
        duration: totalDuration,
        timestamp: new Date().toISOString()
      },
      results: this.results
    }, null, 2));

    console.log(`${colors.gray}Full results saved to: ${reportPath}${colors.reset}\n`);

    // Exit with appropriate code
    process.exit(this.failedTests === 0 ? 0 : 1);
  }
}

// Run the test suite
async function main() {
  const runner = new TestRunner();

  try {
    await runner.initialize();
    await runner.runTestSuite();
  } catch (error) {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
