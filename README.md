# Kochava v1.1.0

[![CI](https://github.com/NaorHai/kochava/workflows/CI/badge.svg)](https://github.com/NaorHai/kochava/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

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
- 🎯 **Skill Auto-Complete** - Simple skills (format, lint, explain) run locally automatically
- ☁️ **Bedrock Support** - Works with AWS Bedrock and enterprise gateways
- 🔧 **Tool Integration** - Local models can use Claude Code skills and MCPs

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
kochava                      # Start interactive conversation (default)
kochava "your question"      # Single query mode
kochava --stats              # Show statistics
kochava --sessions           # List recent sessions
kochava --session <id>       # Resume previous session
kochava --file code.ts "explain this"
kochava --model local        # Force local models only
kochava --model claude       # Force Claude API

# Interactive mode features:
# - Type "/" for arrow-navigable skill menu
# - Type to filter, ↑↓ to navigate, Enter to select, Esc to cancel
# - Auto-complete with Tab
# - Sessions auto-saved (last 3 kept)
# - Context preserved across both local and Claude models
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

# AWS Bedrock (Optional - for enterprise users)
ANTHROPIC_BEDROCK_BASE_URL=https://your-bedrock-gateway.com/bedrock

CLAUDE_TOKEN_BUDGET=8000
AUTO_FALLBACK_ENABLED=true
```

**Note**: Setup script auto-extracts API key and Bedrock URL from `~/.claude/settings.json` if available.

### Tool Integration (Skills & MCPs)

Enable local models to use your Claude Code skills and MCPs:

```bash
ENABLE_LOCAL_TOOLS=true  # Default: true
```

When enabled, **both local and Claude models** can:
- Use Claude Code skills (like /adlc-architect, /simplify)
- Access MCP tools (Slack, GitHub, Confluence, GUS, CUALA, claude-mem)
- Execute multi-step workflows with tool integration

**Example**:
```bash
kochava "search slack for architecture decisions"  # Uses slack_search_public
kochava "find GUS work item W-12345"                # Uses query_gus_records
kochava "execute CUALA test for login flow"        # Uses cuala_execute_scenario
```

**Auto-Discovery Sources**:
Kochava automatically discovers tools from:
- `~/.claude/settings.json` (global MCP servers)
- `~/.claude/blueprints/sf-adlc/skills.json` (blueprint skills)
- `~/.claude/blueprints/sf-adlc/mcp-servers.json` (blueprint MCPs)
- `~/.claude/commands/*.md` (command files)
- `~/.claude/plugins/**/SKILL.md` (plugin skills)

**Note**: MCPs are available to all models, not just Claude!

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

## Development

### Requirements
- Node.js >= 18.0.0
- npm or yarn
- Ollama (for local models)

### Build from Source
```bash
git clone https://github.com/NaorHai/kochava.git
cd kochava
npm install
npm run build
npm test
```

### Run Tests
```bash
npm test              # Type checking + health checks
npm run test:build    # TypeScript compilation check
npm run test:health   # Project structure validation
npm run lint          # Type linting
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## Security

Found a security issue? Please see [SECURITY.md](SECURITY.md) for responsible disclosure.

## Links

- **GitHub**: https://github.com/NaorHai/kochava
- **Issues**: https://github.com/NaorHai/kochava/issues
- **Discussions**: https://github.com/NaorHai/kochava/discussions
- **CI/CD**: https://github.com/NaorHai/kochava/actions

## License

MIT - See [LICENSE](LICENSE) for details

## Acknowledgments

- [Ollama](https://ollama.ai) - Local model infrastructure
- [Anthropic](https://www.anthropic.com) - Claude API
- Built with 💜 by the Kochava community
