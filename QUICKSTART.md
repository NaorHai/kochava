# Quick Start Guide

Get AI Router running in 5 minutes.

## Prerequisites

- macOS (Darwin)
- Node.js 18+ installed
- Terminal access
- 20GB free disk space
- **NO paid API keys required for local models!**

## Installation

```bash
cd ~/Documents/Private/ai-router
./scripts/bootstrap.sh
```

The bootstrap script will:
1. ✅ Install Ollama (FREE local AI server)
2. ✅ Download 4 FREE models (~12GB, takes 10-20 min)
3. ✅ Install npm dependencies
4. ✅ Build the TypeScript project
5. ✅ Run verification tests

**Optional:** You'll be prompted for your Anthropic API key during setup.
- **Skip it** to run with 100% free local models only
- **Add it** to enable Claude for complex tasks (recommended)

See [LOCAL_MODELS.md](LOCAL_MODELS.md) for detailed info on free models.

## First Run

### Interactive Mode

```bash
./run.sh
```

Try these commands:
```
> Format this function: function foo(){return 1}
> Explain how recursion works
> /stats
> /quit
```

### Single Query

```bash
./run.sh query "Explain this code" --context myfile.ts
```

## Verify It's Working

Check which model handled your request:
- Shows `qwen2.5-coder:7b` or `llama3.1:8b` → Local execution ✅
- Shows `claude-sonnet-4` → Claude API used

View statistics:
```bash
./run.sh
> /stats
```

Expected output:
```
Total Requests:    5
Local Requests:    4 (80.0%)
Claude Requests:   1
Tokens Saved:      ~6000
```

## What Gets Routed Where?

### Handled Locally (Fast, Free)
- "Format this code"
- "Rename variable to camelCase"
- "Explain this function"
- "Add comments to this code"

### Escalated to Claude (Accurate, Uses API)
- "Debug why this async function fails"
- "Design an architecture for X"
- "Refactor this entire module"
- "Why does this produce wrong output?"

## Troubleshooting

### Ollama not responding
```bash
# Check if running
curl http://localhost:11434/api/version

# Start manually (macOS)
open /Applications/Ollama.app
```

### Models not found
```bash
ollama list  # Check installed models
bash scripts/install_models.sh  # Reinstall
```

### Build errors
```bash
rm -rf dist node_modules
npm install
npm run build
```

### API key not working
Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Next Steps

1. **Try different task types** to see routing decisions
2. **Check logs** in `logs/` directory to understand routing
3. **Run server mode** with `npm run server` for API access
4. **Read README.md** for full documentation
5. **Explore configuration** in `config/` directory

## Daily Usage

```bash
# Start interactive session
./run.sh

# Check usage stats
./run.sh
> /stats

# Reset token counters
./run.sh
> /reset

# Run as HTTP server
npm run server

# Run as Claude plugin
npm run plugin
```

## Need Help?

- Run: `bash scripts/verify.sh` to diagnose issues
- Check logs: `tail -f logs/routing.log`
- Review config: `cat config/routing.config.json`
- Read full docs: `less README.md`

## Architecture at a Glance

```
Your Request
    ↓
Classifier (local) → Determines task type
    ↓
Complexity Scorer → Rates difficulty
    ↓
Router → Decides: local or Claude?
    ↓
┌─────────────┬──────────────┐
│   Local     │    Claude    │
│   (80%)     │    (20%)     │
└─────────────┴──────────────┘
    ↓
Your Response
```

**Goal**: Handle 60-80% of requests locally, save 70%+ in Claude tokens.

**Status**: Check with `/stats` command!
