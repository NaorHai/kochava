# Kochava

> Intelligent AI router that runs **60-80% of coding tasks FREE** on local models, escalates complex tasks to Claude API only when needed.

```
╔═══════════════════════════════════════════════════════════╗
║     ██╗  ██╗ ██████╗  ██████╗██╗  ██╗ █████╗ ██╗   ██╗  ║
║     ██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██╔══██╗██║   ██║  ║
║     █████╔╝ ██║   ██║██║     ███████║███████║██║   ██║  ║
║     ██╔═██╗ ██║   ██║██║     ██╔══██║██╔══██║╚██╗ ██╔╝  ║
║     ██║  ██╗╚██████╔╝╚██████╗██║  ██║██║  ██║ ╚████╔╝   ║
║     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝    ║
║         Intelligent AI Router • Local + Cloud            ║
╚═══════════════════════════════════════════════════════════╝
```

## Why Kochava?

- 🎉 **FREE Local Models** - Most tasks run FREE (formatting, explanations, simple edits)
- 🧠 **Smart Routing** - Automatically decides local vs Claude based on complexity
- 💰 **70%+ Cost Savings** - Minimize Claude API usage without sacrificing quality
- 🔒 **Privacy First** - Your code never leaves your machine for local tasks
- 🚀 **Auto Fallback** - Seamlessly switches to local when Claude credits run out
- 📊 **Full Transparency** - Track every decision, token, and cost

## Quick Start

### One-Command Setup

```bash
git clone https://github.com/NaorHai/kochava.git
cd kochava
./setup.sh
```

Choose installation type:
- **Docker** (Recommended) - Zero dependencies, everything in containers
- **Local** - Native installation with Ollama

That's it! Setup handles everything:
- ✅ Installs Ollama (local AI server)
- ✅ Downloads 4 FREE models (~12GB)
- ✅ Builds the project
- ✅ Runs verification

## Usage

### Interactive Chat

```bash
npm run kochava -- --chat
```

### Single Query

```bash
npm run kochava -- "format this: function foo(){return 1}"
```

### With File Context

```bash
npm run kochava -- --file mycode.ts "explain this code"
```

### Show Statistics

```bash
npm run kochava -- --stats
```

## What Gets Routed Where?

| Task Type | Route | Examples |
|-----------|-------|----------|
| **Formatting** | 🟢 Local FREE | Code formatting, style fixes |
| **Explanations** | 🟢 Local FREE | "Explain this function", documentation |
| **Simple Edits** | 🟢 Local FREE | Renames, small changes |
| **Small Refactors** | 🟢 Local FREE | Single-file refactoring |
| **Complex Debug** | 🔵 Claude API | Multi-file debugging, root cause analysis |
| **Architecture** | 🔵 Claude API | Design decisions, system patterns |
| **Deep Reasoning** | 🔵 Claude API | Cross-file analysis, complex logic |

## Docker Usage

### Run Single Query
```bash
docker-compose run --rm kochava "your question here"
```

### Start HTTP Server (Port 3000)
```bash
docker-compose --profile server up -d
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"input": "format this: function foo(){return 1}"}'
```

### Start Claude Plugin (Port 3001)
```bash
docker-compose --profile plugin up -d
```

Add to `claude_desktop_config.json`:
```json
{
  "plugins": [{"url": "http://localhost:3001", "enabled": true}]
}
```

## Configuration

### Add Claude API Key (Optional)

Edit `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Optional - leave as "none" for FREE-only
CLAUDE_TOKEN_BUDGET=8000                 # Max tokens per session
AUTO_FALLBACK_ENABLED=true               # Auto-switch to local on errors
```

### Customize Routing Rules

Edit `config/routing.config.json`:
- Adjust complexity thresholds
- Modify task type routing
- Configure fallback behavior

## FREE Local Models

All models run 100% FREE via Ollama:
- **llama3.2:3b** (2GB) - Task classification
- **llama3.1:8b** (5GB) - Context compression
- **qwen2.5-coder:7b** (5GB) - Code editing
- **nomic-embed-text** (274MB) - Semantic search

Total: ~12GB one-time download, then FREE forever.

## Architecture

```
User Request
    ↓
Classifier (local) → Complexity Scorer
    ↓
Router Decision
    ↓
┌──────────────┬──────────────┐
│ Local Models │  Claude API  │
│   (FREE)     │  (Complex)   │
└──────────────┴──────────────┘
    ↓
Response + Metrics
```

## Examples

```bash
# Format code (FREE)
kochava "format this: function foo(){return 1}"
→ Uses qwen2.5-coder:7b locally

# Explain function (FREE)
kochava "explain async/await"
→ Uses llama3.1:8b locally

# Complex debugging (Claude)
kochava "why is my React app re-rendering infinitely?"
→ Escalates to Claude API

# Auto-fallback (FREE)
# If Claude API fails/credits exhausted, automatically uses local model
kochava "complex task" # → Claude fails → Local model takes over
```

## Statistics Tracking

```bash
kochava --stats
```

Output:
```
📊 Usage Statistics

Total Requests:    25
Local (FREE):      19 (76.0%)
Claude (Cloud):    6 (24.0%)
Tokens Saved:      45,000
Claude Tokens:     12,000

Estimated Savings: $135.00
Claude Cost:       $36.00
```

## Troubleshooting

**Ollama not responding:**
```bash
# Check status
curl http://localhost:11434/api/version

# Restart (macOS)
brew services restart ollama
```

**Models missing:**
```bash
# List installed
ollama list

# Re-download
ollama pull llama3.2:3b
```

**Docker issues:**
```bash
# View logs
docker-compose logs -f

# Rebuild
docker-compose build --no-cache
```

## Project Structure

```
kochava/
├── setup.sh              # Unified installation (Docker or Local)
├── docker-compose.yml    # Multi-service Docker setup
├── src/
│   ├── core/            # Routing logic
│   ├── interfaces/      # CLI, server, plugin
│   └── claude/          # Claude API client
├── config/              # Routing & model configs
└── scripts/             # Helper scripts
```

## Advanced

### HTTP Server
```bash
npm run server
# POST /api/process - Process query
# GET /api/metrics - Usage stats
# POST /api/reset - Reset session
```

### Claude Plugin
```bash
npm run plugin
# Integrates with Claude Desktop
# Exposes kochava as a tool
```

### Global Command
```bash
./scripts/install_command.sh
# Then use: kochava "your question" anywhere
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | none | Claude API key (optional) |
| `CLAUDE_TOKEN_BUDGET` | 8000 | Max tokens per session |
| `OLLAMA_HOST` | localhost:11434 | Ollama endpoint |
| `AUTO_FALLBACK_ENABLED` | true | Auto-fallback to local |
| `LOG_LEVEL` | info | Logging verbosity |

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push: `git push origin feature/my-feature`
5. Create Pull Request

## License

MIT - See [LICENSE](LICENSE)

## Links

- **GitHub**: https://github.com/NaorHai/kochava
- **Issues**: https://github.com/NaorHai/kochava/issues
- **Docker Guide**: `README_DOCKER.md`
- **Local Setup**: See `setup.sh` for details
