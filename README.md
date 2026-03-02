# AI Router

An autonomous multi-model routing system that intelligently routes coding requests between local Small Language Models (SLMs) and Claude API, minimizing token consumption while maintaining quality.

## Features

- **FREE Local Models**: 60-80% of requests handled by FREE local SLMs (no API costs!)
- **Automatic Fallback**: Seamlessly switches to local models when Claude credits run out
- **Intelligent Routing**: Automatically classifies tasks and routes to optimal model
- **Privacy-First**: Your code never leaves your machine for local tasks
- **Claude Integration**: Escalates complex reasoning to Claude API only when needed (20-40%)
- **Token Optimization**: 70%+ reduction in Claude token usage = major cost savings
- **Context Management**: Automatic context compression and memory summarization
- **Multiple Interfaces**: CLI, HTTP server, and Claude plugin modes
- **Retrieval System**: Semantic code search with embeddings
- **Comprehensive Logging**: Track routing decisions, token usage, and escalations
- **Offline Capable**: Works without internet for local model tasks
- **Zero Downtime**: Never fails - always falls back to local models gracefully

## Architecture

```
User Input
    ↓
Intent Classifier (Local SLM)
    ↓
Complexity Scorer
    ↓
Task Router
    ↓
┌──────────────┬───────────────┬──────────────┐
│ Local SLM #1 │ Local SLM #2  │   Claude     │
│ Classification │ Compression │ Deep Reason  │
└──────────────┴───────────────┴──────────────┘
    ↓
Output Regulator
    ↓
User Output
```

## Quick Start

### One-Command Installation

```bash
cd ~/Documents/Private/ai-router
./scripts/bootstrap.sh
```

This will:
1. Install Ollama (FREE local model server)
2. Download 4 FREE models (~12GB, one-time)
3. Set up environment
4. Build the project
5. Run verification tests

**All local models are FREE and run offline!** See [LOCAL_MODELS.md](LOCAL_MODELS.md) for details.

### Manual Installation

1. Install Ollama: https://ollama.ai
2. Run setup scripts:
   ```bash
   bash scripts/setup_env.sh
   bash scripts/install_models.sh
   npm run build
   ```
3. Configure `.env` with your `ANTHROPIC_API_KEY`

## Usage

### CLI Mode (Interactive)

```bash
./run.sh
```

Interactive commands:
- `/stats` - Show usage statistics
- `/reset` - Reset session
- `/help` - Show help
- `/quit` - Exit

### CLI Mode (Single Query)

```bash
./run.sh query "Explain this function" --context code.ts
```

### HTTP Server Mode

```bash
npm run server
```

Endpoints:
- `POST /api/process` - Process a query
- `POST /api/index` - Index codebase
- `GET /api/metrics` - Get usage metrics
- `POST /api/reset` - Reset session

Example:
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"input": "Format this code", "context": "function foo(){return 1}"}'
```

### Claude Plugin Mode

```bash
npm run plugin
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "plugins": [
    {
      "url": "http://localhost:3001",
      "enabled": true
    }
  ]
}
```

## Configuration

### Model Configuration (`config/model.config.json`)

Defines which Ollama models to use:
- `classifier`: Intent classification (llama3.2:3b)
- `compressor`: Context compression (llama3.1:8b)
- `codeEditor`: Code editing (qwen2.5-coder:7b)
- `embedding`: Semantic search (nomic-embed-text)

### Routing Configuration (`config/routing.config.json`)

Defines routing rules:
- `taskTypes`: Classification categories and routing targets
- `complexityThresholds`: When to escalate to Claude
- `contextOptimization`: Token optimization settings
- `memoryManagement`: Conversation history management
- `escalation`: Supervisor and override settings

## Task Types

| Task Type | Route | Description |
|-----------|-------|-------------|
| `trivial_edit` | Local | Simple code changes, renames |
| `formatting` | Local | Code formatting, style fixes |
| `explanation` | Local | Code explanations, documentation |
| `refactor_small` | Local | Small refactoring within a file |
| `deep_debug` | Claude | Complex debugging |
| `architecture` | Claude | Design decisions, patterns |
| `multi_file_reasoning` | Claude | Cross-file analysis |

## Logging

Logs are written to `logs/`:
- `routing.log` - Routing decisions and system events
- `token_usage.log` - Token consumption tracking
- `escalation.log` - Task escalations to Claude

## Performance Goals

- ✅ 60-80% of requests handled locally
- ✅ 70%+ reduction in Claude token usage
- ✅ Local task latency under 3 seconds
- ✅ Claude calls minimized and measurable

## Project Structure

```
ai-router/
├── config/              # Configuration files
├── src/
│   ├── core/           # Core routing logic
│   │   ├── classifier.ts
│   │   ├── complexity.ts
│   │   ├── router.ts
│   │   ├── context_optimizer.ts
│   │   ├── escalation.ts
│   │   ├── local-executor.ts
│   │   ├── memory-manager.ts
│   │   └── orchestrator.ts
│   ├── claude/         # Claude API integration
│   ├── retrieval/      # Embeddings and search
│   ├── interfaces/     # CLI, server, plugin
│   ├── types/          # TypeScript types
│   └── utils/          # Utilities
├── scripts/            # Setup and maintenance
├── plugin/             # Claude plugin specs
└── logs/               # Runtime logs
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode with hot reload
npm run dev

# Run tests
npm test
```

## Troubleshooting

### Ollama not responding
```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# Start Ollama
open /Applications/Ollama.app  # macOS
```

### Models not found
```bash
# List installed models
ollama list

# Reinstall models
bash scripts/install_models.sh
```

### Claude API errors
- Verify `ANTHROPIC_API_KEY` in `.env`
- Check token budget in `.env` (`CLAUDE_TOKEN_BUDGET`)
- Review logs in `logs/routing.log`

### Build errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | - | Claude API key (required) |
| `CLAUDE_TOKEN_BUDGET` | 8000 | Max tokens per session |
| `OLLAMA_HOST` | http://localhost:11434 | Ollama API endpoint |
| `SERVER_PORT` | 3000 | HTTP server port |
| `PLUGIN_PORT` | 3001 | Plugin server port |
| `LOG_LEVEL` | info | Logging level |

## Git Workflow

The project includes `.gitignore` rules to keep the repository clean:
- Models are managed by Ollama (not committed)
- `.env` is not committed (use `.env.example`)
- Build artifacts are not committed
- Logs are not committed

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and verification
5. Submit a pull request

## Support

For issues and questions:
- Check logs in `logs/` directory
- Run verification: `bash scripts/verify.sh`
- Review configuration in `config/`
- Check Ollama status: `ollama list`
