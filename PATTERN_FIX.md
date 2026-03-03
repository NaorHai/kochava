# Pattern Matching Fix - v1.6.1

## Issue
User command `"list all files in Downloads"` was returning:
```
Could not extract a valid bash command from your request.
```

## Root Cause
The natural language pattern matching was too restrictive:
1. **ComputerUseExecutor**: Pattern `/(?:list|show|display)\s+files?\s+in\s+(.+)/` didn't allow words like "all" between "list" and "files"
2. **FastRouter**: Patterns didn't catch "what's inside X" or "show directory X"

## Solution

### 1. Enhanced ComputerUseExecutor Patterns
```typescript
// Before: /(?:list|show|display)\s+files?\s+in\s+(.+)/
// After:  /(?:list|show|display)\s+(?:all\s+|the\s+)?files?\s+in\s+(.+)/
```

**New patterns added:**
- `(?:all\s+|the\s+)?` - Allows "all" or "the" modifiers
- Relative path handling: "Downloads" → "~/Downloads"
- "what's inside X" pattern (not just "what's in X")
- "show directory X" pattern
- "count files in X" pattern

### 2. Enhanced FastRouter Detection
```typescript
// More flexible patterns for routing to computer_use
const patterns = [
  // Now catches: "show directory X", "list all files", etc.
  /\b(list|show|display|get|view)\s+(?:all\s+|the\s+)?(files?|directories?|directory|folders?|folder|contents?)\b/i,
  // Now catches: "what's inside X" (not just "what's in X")
  /\bwhat('s| is| are)\s+(in|inside)\b/i,
  // Plus count pattern
  /\bcount\s+files?\s+in\s+/i
];
```

## Test Results

All patterns now working correctly:

```bash
✓ "list all files in Downloads"    → computer_use (37ms)  ← Fixed!
✓ "list files in Downloads"         → computer_use (22ms)
✓ "list the files in Documents"     → computer_use (8ms)
✓ "show all files in Source"        → computer_use (8ms)
✓ "what's inside Downloads"         → computer_use (18ms)  ← Fixed!
✓ "show directory Documents"        → computer_use (9ms)   ← Fixed!
✓ "count files in Downloads"        → computer_use (20ms)
```

## Supported Patterns

### List Operations
- `list files in X`
- `list all files in X`
- `list the files in X`
- `show files in X`
- `display files in X`

### Directory Operations
- `show directory X`
- `list directory X`
- `what's in X`
- `what's inside X`
- `what is in X`

### File Counting
- `count files in X`

### Path Handling
- Absolute paths: `/path/to/dir` → Uses as-is
- Home paths: `~/Downloads` → Uses as-is
- Relative names: `Downloads` → Converts to `~/Downloads`

## Files Modified
- `src/core/computer-use-executor.ts` - Enhanced extractCommand patterns
- `src/core/fast-router.ts` - Enhanced isFileOperation patterns

## Version
- **Before:** 1.6.0
- **After:** 1.6.1 (pattern fixes)

## Testing
```bash
cd ~/Documents/Private/kochava
npm run build
node test-patterns.js
```

**Expected:** All tests pass with computer_use route ✅
