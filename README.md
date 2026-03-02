# Kochava

> **60-80% of coding tasks run FREE** on local models. Complex tasks escalate to Claude API automatically.

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██╗  ██╗ ██████╗  ██████╗██╗  ██╗ █████╗ ██╗   ██╗ █████╗     ║
║   ██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██╔══██╗██║   ██║██╔══██╗    ║
║   █████╔╝ ██║   ██║██║     ███████║███████║██║   ██║███████║    ║
║   ██╔═██╗ ██║   ██║██║     ██╔══██║██╔══██║╚██╗ ██╔╝██╔══██║    ║
║   ██║  ██╗╚██████╔╝╚██████╗██║  ██║██║  ██║ ╚████╔╝ ██║  ██║    ║
║   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝    ║
║                                                                   ║
║            Intelligent AI Router • Local + Cloud                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

## Features

- 🎉 **FREE Local Models** - Most requests handled locally (no API costs)
- 🧠 **Smart Routing** - Auto-detects complexity, routes to best model
- 💰 **70%+ Savings** - Minimize Claude API usage
- 🔒 **Privacy First** - Code never leaves your machine for local tasks
- 🚀 **Auto Fallback** - Switches to local when Claude credits exhausted

## Quick Start

```bash
git clone https://github.com/NaorHai/kochava.git
cd kochava
./setup.sh
```

Choose: **1) Docker** (recommended) or **2) Local**

## Usage

### Install Global Command (Recommended)

```bash
./scripts/install_command.sh
```

Then use from anywhere:

```bash
kochava "format this: function foo(){return 1}"
kochava --chat           # Interactive mode
kochava --stats          # Show statistics
kochava --file code.ts "explain this"
```

### Docker Mode

```bash
docker-compose run --rm kochava "your question here"
```

### NPM Scripts (Alternative)

```bash
npm run kochava -- "your question"
npm run kochava -- --chat
```

## What Runs Where?

| Task | Model | Cost |
|------|-------|------|
| Formatting, simple edits | 🟢 Local FREE | $0.00 |
| Explanations, documentation | 🟢 Local FREE | $0.00 |
| Small refactors | 🟢 Local FREE | $0.00 |
| Complex debugging | 🔵 Claude API | ~$0.01-0.05 |
| Architecture design | 🔵 Claude API | ~$0.01-0.05 |
| Multi-file reasoning | 🔵 Claude API | ~$0.01-0.05 |

## Examples

```bash
# Format code (FREE)
kochava "format this: function foo(){return 1}"

# Explain concept (FREE)
kochava "explain async/await in JavaScript"

# Debug issue (FREE or Claude)
kochava "why does my React app re-render infinitely?"

# With file context
kochava --file app.ts "find the bug"

# Interactive chat
kochava --chat
```

## Configuration

Add Claude API key (optional) in `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Optional
CLAUDE_TOKEN_BUDGET=8000
AUTO_FALLBACK_ENABLED=true
```

## Statistics

```bash
kochava --stats
```

Example output:
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

## How It Works

```
User Question
    ↓
Classifier (local) → Complexity Scorer
    ↓
┌──────────────┬──────────────┐
│ Local Models │  Claude API  │
│   (FREE)     │  (Complex)   │
└──────────────┴──────────────┘
    ↓
Response + Stats
```

## FREE Local Models

All models included (~12GB one-time download):
- **llama3.2:3b** (2GB) - Classification
- **llama3.1:8b** (5GB) - Compression
- **qwen2.5-coder:7b** (5GB) - Code editing
- **nomic-embed-text** (274MB) - Embeddings

## Advanced

### HTTP Server (Port 3000)
```bash
npm run server
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"input": "your question"}'
```

### Docker Compose Profiles
```bash
docker-compose --profile server up -d   # HTTP server
docker-compose --profile plugin up -d   # Claude plugin
```

### Customize Routing
Edit `config/routing.config.json` to adjust thresholds and rules.

## Project Structure

```
kochava/
├── setup.sh           # Unified installation
├── src/
│   ├── core/         # Routing logic
│   └── interfaces/   # CLI, server, plugin
├── config/           # Configs
└── scripts/          # Helpers
```

## Links

- **GitHub**: https://github.com/NaorHai/kochava
- **Issues**: https://github.com/NaorHai/kochava/issues

## License

MIT
