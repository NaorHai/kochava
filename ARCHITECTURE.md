# AI Router - Architecture Documentation

## System Overview

AI Router is a multi-model routing system that intelligently distributes coding requests between local SLMs and Claude API based on task complexity.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface Layer                    │
│  ┌─────────┐      ┌──────────┐      ┌────────────────┐     │
│  │   CLI   │      │  Server  │      │ Claude Plugin  │     │
│  └────┬────┘      └─────┬────┘      └────────┬───────┘     │
└───────┼──────────────────┼──────────────────┼──────────────┘
        │                  │                   │
        └──────────────────┴───────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │      Core Orchestrator              │
        │  - Session Management               │
        │  - Context Optimization             │
        │  - Metric Tracking                  │
        └──────────────┬─────────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │       Task Router               │
        │  ┌──────────┐  ┌──────────┐    │
        │  │Classifier│  │Complexity│    │
        │  │          │  │ Scorer   │    │
        │  └──────────┘  └──────────┘    │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │    Routing Decision             │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │                                  │
┌───────▼────────┐           ┌────────────▼────────┐
│ Local Executor │           │   Claude Client     │
│                │           │                     │
│ ┌────────────┐ │           │ ┌─────────────────┐ │
│ │ Code Edit  │ │           │ │ Context Opt     │ │
│ │ Model      │ │           │ │ Token Budget    │ │
│ └────────────┘ │           │ │ Supervisor      │ │
│                │           │ └─────────────────┘ │
│ ┌────────────┐ │           │                     │
│ │ Compression│ │           │ ┌─────────────────┐ │
│ │ Model      │ │           │ │ Anthropic API   │ │
│ └────────────┘ │           │ └─────────────────┘ │
└────────────────┘           └─────────────────────┘
        │                              │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │     Response Formatting         │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼──────────────────┐
        │      Logging & Metrics          │
        │  - routing.log                  │
        │  - token_usage.log              │
        │  - escalation.log               │
        └─────────────────────────────────┘
```

## Component Details

### 1. Interface Layer

Three entry points, all using the same core routing logic:

#### CLI (`src/interfaces/cli.ts`)
- Interactive REPL mode
- Single query mode
- Built-in commands (/stats, /reset, /help)

#### HTTP Server (`src/interfaces/server.ts`)
- REST API for integration
- POST /api/process - Process queries
- GET /api/metrics - Retrieve metrics

#### Plugin Adapter (`src/interfaces/plugin_adapter.ts`)
- Claude Desktop plugin interface
- OpenAPI specification
- Plugin manifest for discovery

### 2. Core Orchestrator (`src/core/orchestrator.ts`)

Central coordinator that:
- Initializes all subsystems
- Manages conversation history
- Tracks usage metrics
- Coordinates between local and cloud execution
- Handles code indexing and retrieval

### 3. Task Router (`src/core/router.ts`)

Makes routing decisions based on:
- Task classification
- Complexity score
- Confidence threshold
- Escalation rules

**Routing Flow:**
```
Input → Classify → Score Complexity → Apply Rules → Route
```

### 4. Task Classifier (`src/core/classifier.ts`)

Uses local SLM to classify tasks into types:
- trivial_edit
- formatting
- explanation
- refactor_small
- deep_debug
- architecture
- multi_file_reasoning

**Classification Process:**
1. Build prompt with task descriptions
2. Query local classifier model
3. Parse response
4. Fallback to keyword matching if needed

### 5. Complexity Scorer (`src/core/complexity.ts`)

Calculates complexity score (0-10) based on:
- Lines of code involved
- Number of files
- Dependencies referenced
- Reasoning depth required

### 6. Context Optimizer (`src/core/context_optimizer.ts`)

Reduces token consumption by:
- Stripping comments
- Removing blank lines
- Deduplicating imports
- Truncating to token limit

**Token Savings:**
- Average: 30-50% reduction
- Comments-heavy code: 60%+ reduction

### 7. Memory Manager (`src/core/memory-manager.ts`)

Manages conversation history:
- Tracks turns with token counts
- Automatically summarizes after N turns
- Keeps recent history within token budget
- Prevents context window overflow

### 8. Escalation Manager (`src/core/escalation.ts`)

Handles task escalation:
- Logs escalation events
- Tracks escalation statistics
- Determines if retry is worthwhile

### 9. Local Executor (`src/core/local-executor.ts`)

Executes tasks on local models:
- Code editing (qwen2.5-coder:7b)
- Compression/explanation (llama3.1:8b)
- Configurable temperature and tokens

### 10. Claude Client (`src/claude/client.ts`)

Manages Claude API:
- Token budget enforcement
- Message formatting
- Token usage tracking
- Error handling

### 11. Claude Supervisor (`src/claude/supervisor.ts`)

Optional override mechanism:
- Claude can review routing decisions
- Can escalate tasks that need deeper reasoning
- Configurable via `escalation.allowClaudeOverride`

### 12. Retrieval System

#### Embedder (`src/retrieval/embedder.ts`)
- Generates embeddings with nomic-embed-text
- Calculates cosine similarity
- Batch processing support

#### Code Indexer (`src/retrieval/indexer.ts`)
- Chunks code into searchable segments
- Creates embeddings for each chunk
- Semantic search with top-K results
- Persistent index storage

## Data Flow

### Typical Request Flow

```
1. User submits request via CLI/Server/Plugin
      ↓
2. Orchestrator receives input
      ↓
3. Add to conversation history
      ↓
4. Router classifies task
      ↓
5. Router scores complexity
      ↓
6. Router makes routing decision
      ↓
7. (Optional) Supervisor reviews decision
      ↓
8. Execute on chosen target:

   LOCAL PATH:                 CLAUDE PATH:
   - Optimize context          - Optimize context
   - Execute on Ollama         - Retrieve relevant code
   - Return response           - Call Claude API
                               - Track token usage
                               - Return response
      ↓
9. Add response to history
      ↓
10. Log metrics
      ↓
11. Return to user
```

## Configuration System

### Model Configuration (`config/model.config.json`)

Defines Ollama models:
```json
{
  "models": {
    "classifier": { "name": "llama3.2:3b", ... },
    "compressor": { "name": "llama3.1:8b", ... },
    "codeEditor": { "name": "qwen2.5-coder:7b", ... },
    "embedding": { "name": "nomic-embed-text", ... }
  }
}
```

### Routing Configuration (`config/routing.config.json`)

Defines routing rules:
```json
{
  "taskTypes": { ... },
  "complexityThresholds": { "local": 4, "claude": 5 },
  "contextOptimization": { ... },
  "memoryManagement": { ... },
  "escalation": { ... }
}
```

## Logging Architecture

Three specialized log files:

1. **routing.log** - System events, routing decisions
2. **token_usage.log** - Token consumption, API calls
3. **escalation.log** - Task escalations, override decisions

All logs use structured JSON format with timestamps.

## Performance Characteristics

### Latency

| Operation | Target | Typical |
|-----------|--------|---------|
| Classification | < 500ms | 200-300ms |
| Local execution | < 3s | 1-2s |
| Claude execution | < 10s | 3-8s |
| Context optimization | < 100ms | 20-50ms |

### Token Efficiency

| Metric | Target | Typical |
|--------|--------|---------|
| Local request ratio | 60-80% | 70-75% |
| Token savings | 70%+ | 75-80% |
| Context reduction | 30-50% | 40-45% |

## Scalability Considerations

### Current Design

- Single-threaded execution
- In-memory conversation history
- Local file-based code index
- Synchronous API calls

### Future Enhancements

- Multi-user session management
- Distributed code indexing
- Parallel model execution
- Streaming responses
- Redis-based caching

## Security Model

### Local Security

- No external network access (except Claude API)
- Models run in Ollama sandbox
- Logs stored locally

### API Security

- API key stored in `.env` (gitignored)
- Token budget enforcement
- Rate limiting (via Claude API)

### Plugin Security

- Localhost-only binding
- No authentication (localhost trust)
- No data persistence beyond logs

## Error Handling

### Graceful Degradation

1. Classifier fails → Keyword-based fallback
2. Local model unavailable → Escalate to Claude
3. Claude API fails → Return error, log incident
4. Context too large → Truncate with notification

### Recovery Strategies

- Automatic retry on transient failures
- Circuit breaker for repeated failures
- Fallback routing on model unavailability

## Testing Strategy

### Verification Script (`scripts/verify.sh`)

Tests:
1. Ollama connectivity
2. Model availability
3. Environment configuration
4. Build artifacts
5. Model responsiveness

### Manual Testing

```bash
# Test classification
echo "Format this code" | ./run.sh query -

# Test complexity scoring
./run.sh query "Design a microservices architecture"

# Test metrics
./run.sh query "test" && ./run.sh stats
```

## Deployment

### Local Deployment (Primary)

```bash
./scripts/bootstrap.sh
./run.sh
```

### Server Deployment

```bash
npm run server
# Runs on http://localhost:3000
```

### Plugin Deployment

```bash
npm run plugin
# Runs on http://localhost:3001
# Configure in Claude Desktop
```

## Monitoring

### Real-Time Monitoring

```bash
# Watch routing decisions
tail -f logs/routing.log | jq .

# Monitor token usage
tail -f logs/token_usage.log | jq .

# Track escalations
tail -f logs/escalation.log | jq .
```

### Metrics Dashboard

Access via CLI:
```bash
./run.sh stats
```

Access via API:
```bash
curl http://localhost:3000/api/metrics
```

## Dependencies

### External Services
- Ollama (local LLM server)
- Anthropic API (Claude)

### NPM Packages
- `@anthropic-ai/sdk` - Claude API client
- `ollama` - Ollama client
- `express` - HTTP server
- `winston` - Logging
- `commander` - CLI framework
- `chalk` - Terminal colors

## File Organization

```
src/
├── core/           # Framework-agnostic routing logic
├── claude/         # Claude API integration
├── retrieval/      # Embeddings and search
├── interfaces/     # Entry points (CLI, server, plugin)
├── types/          # TypeScript type definitions
└── utils/          # Shared utilities

config/             # JSON configuration files
scripts/            # Setup and maintenance scripts
plugin/             # Claude plugin specifications
logs/               # Runtime logs (gitignored)
```

## Extension Points

### Adding New Task Types

1. Add to `config/routing.config.json`:
   ```json
   "new_task_type": {
     "description": "...",
     "route": "local_code",
     "maxComplexity": 3,
     "keywords": [...]
   }
   ```

2. Restart service (no code changes needed)

### Adding New Models

1. Add to `config/model.config.json`
2. Pull model: `ollama pull model-name`
3. Update executor to use new model

### Custom Routing Logic

Modify `src/core/router.ts`:
```typescript
async route(context: TaskContext): Promise<RoutingDecision> {
  // Custom logic here
}
```

## Troubleshooting Guide

See main README.md for common issues and solutions.

## Future Architecture

Potential enhancements:
- Distributed routing with load balancing
- Multi-cloud provider support (OpenAI, Gemini, etc.)
- Fine-tuned routing model
- Reinforcement learning from user feedback
- Persistent code index with vector database
- Real-time streaming responses
