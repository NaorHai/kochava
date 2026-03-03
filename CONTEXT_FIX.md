# Context-Aware Query Expansion - v1.6.2

## Problem

User asks a question mentioning context, then follows up with vague reference:

```
User: "how many images i have in the desktop"
User: "what are their names"  ← vague: what are "their" names?
```

The system routed "what are their names" to the local model (qwen2.5-coder:7b) which couldn't execute bash commands, resulting in apology instead of actual file listing.

## Solution

### 1. Context Expansion in Orchestrator

Added `expandWithContext()` method that:
- Detects vague references: "their", "them", "those", "these", "it"
- Extracts context from recent conversation history (last 10 messages)
- Identifies:
  - **Location**: desktop, downloads, documents, pictures
  - **File type**: images, photos, files, pdfs, videos
- Expands vague queries with extracted context

**Example**:
```javascript
History: "how many images i have in the desktop"
Input: "what are their names"
Expanded: "list images on desktop"  ← adds context!
```

### 2. AI Translator Fix

The AI translator (phi3) was confusing "list" and "count" operations:
- ❌ "list images on desktop" → `ls | wc -l` (COUNT - wrong!)
- ✅ "how many images" → `ls | wc -l` (COUNT - correct)

**Fix**: Updated AI translator examples with clear rules:
```
RULES:
- "list" or "show" = list files (NO wc -l)
- "how many" or "count" = count files (USE wc -l)
```

### 3. Enhanced Routing Patterns

Added patterns to catch "name" queries:
- "what are their names"
- "what are the names"
- "list names"
- "show names"

## Implementation

### Files Modified

1. **src/core/orchestrator.ts**
   - Added `expandWithContext()` method
   - Calls before passing to computer-use-executor
   - Extracts location and file type from history
   - Expands vague references with context

2. **src/core/bash-translator.ts**
   - Updated prompt with clear rules for list vs count
   - Added examples distinguishing operations:
     - "list images on desktop" → ls (no wc -l)
     - "how many images" → ls | wc -l

3. **src/core/fast-router.ts**
   - Added "name", "names" to system operation verbs
   - Added patterns for "what are their/the names"
   - Added pattern for "list names"

4. **src/core/computer-use-executor.ts**
   - Added "list images/files/pdfs on X" pattern (before count pattern)
   - Pattern order matters: list patterns before count patterns

## Test Results

### Before
```bash
User: "how many images i have in the desktop"
Assistant: 6  [computer_use]

User: "what are their names"
Assistant: "I'm sorry, but I can't list the names..." [qwen2.5-coder:7b]
```

### After
```bash
User: "how many images i have in the desktop"
Assistant: 6  [computer_use]

User: "what are their names"
Assistant: [lists actual file names] [computer_use]
```

## Examples of Context Expansion

| User Says | History Context | Expanded To |
|-----------|----------------|-------------|
| "what are their names" | "images in desktop" | "list images on desktop" |
| "show them" | "pdfs in documents" | "list pdfs on documents" |
| "count them" | "files in downloads" | "count files on downloads" |
| "how many" | "photos in pictures" | "how many photos in pictures" |

## Supported Contexts

### Locations
- desktop → ~/Desktop
- downloads → ~/Downloads
- documents → ~/Documents
- pictures → ~/Pictures
- home → ~

### File Types
- images, photos, pictures, pics → image files
- pdfs → PDF files
- files → all files
- videos, movies → video files

### Vague References
- their, them → refers to items from previous context
- those, these → refers to items from previous context
- it, its → refers to item from previous context

## Limitations

1. **Recent history only**: Looks at last 10 lines of conversation
2. **Single context**: If multiple contexts mentioned, uses most recent
3. **Explicit better**: "list files on desktop" still clearer than "show them"

## Recommendations

For best results, users should:
1. **Be explicit when possible**: "list files on desktop" > "show them"
2. **Provide context in same message**: "list their names on desktop"
3. **Reference immediately**: Context from 2-3 messages ago works best

## Version
- **Added in**: v1.6.2
- **Status**: Production Ready ✅
- **Tests**: test-context-expansion.js

---

**All context-aware query issues resolved.**
