# Kochava Test Suite Documentation

## Overview

**73 automated tests** ensure kochava operates correctly across all execution paths.

## Test Structure

| Test Suite | Tests | Duration | Purpose |
|------------|-------|----------|---------|
| Health | 8 | <1s | Project structure validation |
| Smoke | 3 | ~10s | Critical path sanity checks |
| Integration | 18 | ~2min | All routes and error handling |
| Comprehensive | 44 | ~3min | AI bash translation coverage |
| **TOTAL** | **73** | **~5min** | **Full regression suite** |

## Running Tests

```bash
# Run all tests
npm test

# Individual suites
npm run test:health         # 8 tests - Project structure
npm run test:smoke          # 3 tests - Quick sanity check
npm run test:suite          # 18 tests - Integration tests
npm run test:comprehensive  # 44 tests - Bash translator tests
```

## Test Coverage

### 1. Health Tests (8 tests)

Validates project structure and required files:

```bash
npm run test:health
```

**Checks:**
- ✅ dist/ directory exists
- ✅ config/ directory exists
- ✅ Main entry point exists
- ✅ routing.config.json exists
- ✅ model.config.json exists
- ✅ .env.example exists
- ✅ setup.sh exists
- ✅ install_command.sh exists

### 2. Smoke Tests (3 tests)

Quick validation of critical paths:

```bash
npm run test:smoke
```

**Tests:**
- ✅ Computer-use route (direct bash: `pwd`)
- ✅ Natural language file operations (`list files in ~/Downloads`)
- ✅ Local model execution (simple query: `what is 2+2?`)

### 3. Integration Tests (18 tests)

Comprehensive routing and execution validation:

```bash
npm run test:suite
```

**Coverage:**
- Computer-use: Direct bash commands (3 tests)
- Computer-use: Natural language file ops (2 tests)
- Computer-use: Pattern variations (3 tests)
- Skills invocation (1 test)
- Local model execution (3 tests)
- Routing logic (1 test)
- Error handling (3 tests)
- Performance benchmarks (2 tests)

### 4. Comprehensive Bash Tests (44 tests)

AI-powered bash translator validation with real test data:

```bash
npm run test:comprehensive
```

**Categories (44 tests total):**

1. **Direct Bash Commands** (5 tests)
   - ls, pwd, whoami, echo, df

2. **Natural Language - File Listing** (5 tests)
   - "list files in test-data"
   - "show files in test-data/code"
   - "what is in test-data/documents"

3. **Natural Language - File Search** (5 tests)
   - "show me all python files"
   - "find javascript files"
   - "search for java files"

4. **Natural Language - Size Operations** (4 tests)
   - "find large files bigger than 100MB"
   - "show files larger than 50MB"
   - "show disk usage"

5. **Natural Language - Content Search** (4 tests)
   - "search for TODO in test-data"
   - "find files containing hello"
   - "grep for function"

6. **Natural Language - Counting** (4 tests)
   - "count files in test-data"
   - "count lines in file"
   - "how many files"

7. **Natural Language - Hidden Files** (3 tests)
   - "list hidden files"
   - "show me hidden files"
   - "find files starting with dot"

8. **Natural Language - Nested Operations** (3 tests)
   - "find all files recursively"
   - "search in all subdirectories"

9. **System Commands** (4 tests)
   - "show running processes"
   - "display system uptime"
   - "check disk space"

10. **Edge Cases** (4 tests)
    - "list files modified today"
    - "find empty files"
    - "show file permissions"

11. **Security Tests** (3 tests)
    - Blocks: rm -rf /
    - Blocks: rm -rf ~
    - Blocks: chmod -R 777 /

## Test Data

Located in `test-data/` directory:

```
test-data/
├── code/          # Python, JavaScript, TypeScript, Java
├── documents/     # TXT, Markdown
├── hidden/        # Dotfiles
├── large/         # 101MB binary file
└── nested/        # Deep directory structure
```

See `test-data/README.md` for details.

## Success Criteria

All tests must pass with 100% success rate:

```
✓ 73/73 tests passing
✓ TypeScript compilation succeeds
✓ No console errors or warnings
✓ Performance benchmarks within limits
✓ Security tests block dangerous commands
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-publish (via prepublishOnly hook)

## Test Results

Results are saved to:
- `test-results.json` - Integration test results
- `test-results-comprehensive.json` - Comprehensive bash test results

## Quality Gates

Before merging:
1. ✅ All 73 tests pass
2. ✅ TypeScript strict mode compilation succeeds
3. ✅ No linting errors
4. ✅ Performance benchmarks validated
5. ✅ Security tests confirm dangerous commands blocked

## Adding New Tests

### For new bash patterns:

Add to `test/comprehensive-bash-test.js` in appropriate category.

### For new features:

Add to `test/integration-test-suite.js` using the `runTest()` method:

```javascript
await this.runTest(
  'Category',
  'Test name',
  'input query',
  async (response) => {
    return {
      passed: /* assertion */,
      message: 'explanation'
    };
  }
);
```

## Troubleshooting

### Tests failing?

1. Ensure Ollama is running: `ollama list`
2. Check required models: `phi3`, `qwen2.5-coder:7b`, `llama3.1:8b`
3. Rebuild: `npm run build`
4. Check test data exists: `ls test-data/`

### Slow tests?

- Use `npm run test:smoke` for quick checks
- Run specific suites individually
- Comprehensive tests take ~3 minutes (44 AI translations)

## Version History

- **v1.6.2** - Added comprehensive bash translator tests (44 tests)
- **v1.6.1** - Added integration test suite (18 tests)
- **v1.6.0** - Added computer-use route tests (5 tests)
- **v1.5.1** - Initial test suite (8 tests)

---

**Total: 73 tests | 100% pass rate | ~5 minutes runtime**
