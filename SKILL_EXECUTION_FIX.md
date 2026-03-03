# Skill Execution Fix - v1.7.1

## Problem

User reported:
> `/budget` returns correct JSON but qwen2.5-coder:7b adds hallucinated apology: "I apologize for the confusion..."

**Root Cause**: Skills with `allowed-tools: Bash` weren't executing bash commands directly because the extraction logic filtered out code blocks that START with comments.

## The Bug

In `src/core/tool-executor.ts`, the `extractBashCommands()` function had this check:

```typescript
// BUG - line 206:
if (command && !command.startsWith('#') && command.length > 0) {
  commands.push(command);
}
```

The `/budget` skill's bash block starts with a comment:
```bash
# Extract token from settings
TOKEN=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN' ~/.claude/settings.json) || exit 1
...
```

**Result**: The entire code block was filtered out because it starts with `#`, causing the skill to bypass direct execution and fall back to passing the skill content through qwen2.5-coder:7b, which doesn't understand JSON data and hallucinates apologies.

## The Fix

### 1. Fixed Bash Command Extraction (tool-executor.ts:206)

```typescript
// BEFORE (WRONG):
if (command && !command.startsWith('#') && command.length > 0) {
  commands.push(command); // Filters out blocks starting with comments
}

// AFTER (CORRECT):
if (command && command.length > 0) {
  commands.push(command); // Include entire block - bash handles comments properly
}
```

### 2. Added Direct Output Detection (tool-executor.ts:99)

```typescript
// Skills that return structured data should NOT pass through LLM
private isDirectOutputSkill(skillName: string, skillContent: string): boolean {
  const directOutputSkills = [
    'budget', 'stats', 'sessions', 'list', 'search',
    'get', 'show', 'fetch', 'query', 'find'
  ];

  return directOutputSkills.includes(skillName.toLowerCase()) ||
         contentHasJSON || contentHasStructuredOutput;
}
```

This provides a safety net if bash extraction fails - direct output skills won't be processed by LLM.

## How Skills Should Work

**Correct Flow**:
```
User: /budget
  ↓
1. Read SKILL.md
2. Parse YAML: allowed-tools: Bash
3. Extract bash commands from ```bash blocks
4. Execute bash directly
5. Return output (JSON, text, etc)
  ↓
Result: Clean output, 0 tokens, no LLM involved
```

**Before Fix (WRONG)**:
```
User: /budget
  ↓
1. Read SKILL.md
2. Parse YAML: allowed-tools: Bash
3. Extract bash commands... FAILS (filtered by comment check)
4. Fall back to: isSkillInstructions = true
5. Pass skill content through qwen2.5-coder:7b
6. Model doesn't understand JSON, hallucinates apology
  ↓
Result: JSON + hallucinated apology, wasted tokens
```

## Test Results

### Before Fix
```bash
User: /budget
Output:
{
  "user_id": "user@example.com",
  "spend": 125.28,
  "max_budget": 170.0,
  "remaining": 44.72,
  "budget_reset_at": "2026-04-01T00:00:00Z"
}

I apologize for the confusion earlier... [HALLUCINATION]

[qwen2.5-coder:7b (skill) • 847 tokens • 2145ms]
```

### After Fix
```bash
User: /budget
Output:
{
  "user_id": "user@example.com",
  "spend": 125.28,
  "max_budget": 170.0,
  "remaining": 44.72,
  "budget_reset_at": "2026-04-01T00:00:00Z"
}

[qwen2.5-coder:7b (skill) • 0 tokens • 641ms]
```

**No hallucination, 0 tokens, 60% faster**

## Skills That Benefit

All skills with `allowed-tools: Bash` now execute correctly:
- ✅ `/budget` - Budget information
- ✅ `/sessions` - Session listing
- ✅ `/stats` - Usage statistics
- ✅ Any custom skill with bash commands
- ✅ Skills with bash blocks that start with comments

## Impact

**User Experience:**
- ✅ Skills return clean output (no hallucinated text)
- ✅ Direct bash execution (no LLM overhead)
- ✅ Faster responses (no model latency)
- ✅ 0 token usage for bash skills

**Technical:**
- ✅ Bash comments no longer break extraction
- ✅ Direct output skills have safety net
- ✅ Proper execution flow: bash → output (no LLM)
- ✅ Token savings: 100% for bash skills

## Files Modified

1. **src/core/tool-executor.ts**
   - Line 206: Removed `!command.startsWith('#')` check
   - Lines 99-147: Added `isDirectOutputSkill()` method

## Version
- **Fixed in**: v1.7.1
- **Files changed**: 1 (tool-executor.ts)
- **Lines changed**: ~60
- **Test coverage**: All skill tests pass ✅

---

**Status**: Production Ready ✅
**User Report**: Resolved ✅
**Skills now execute bash commands directly without LLM hallucinations.**
