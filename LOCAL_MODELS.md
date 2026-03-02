# Local Free Models Configuration

This system uses **100% FREE, locally-running models** via Ollama. No paid subscriptions required for local execution.

## What are Local Models?

Local models (also called Small Language Models or SLMs) run entirely on your machine:
- ✅ **FREE** - No API costs, no subscriptions
- ✅ **Private** - Your code never leaves your machine
- ✅ **Fast** - No network latency
- ✅ **Offline** - Works without internet (after initial download)

## Models Used

| Model | Size | Purpose | Cost |
|-------|------|---------|------|
| **llama3.2:3b** | 2.0GB | Task classification | FREE |
| **llama3.1:8b** | 4.7GB | Code compression & explanations | FREE |
| **qwen2.5-coder:7b** | 4.7GB | Code editing & formatting | FREE |
| **nomic-embed-text** | 274MB | Semantic code search | FREE |

**Total Download:** ~12GB (one-time)

## What Can Local Models Handle?

These FREE local models handle **60-80% of coding requests**:

### ✅ Handled 100% Locally (No API Needed)
- Code formatting and style fixes
- Simple refactoring (rename, extract method)
- Variable/function renaming
- Adding comments and documentation
- Explaining code functionality
- Simple bug fixes
- Code structure analysis
- Import organization

### 🔄 Escalated to Claude (Optional)
- Complex debugging requiring deep reasoning
- Architectural design decisions
- Multi-file refactoring
- Performance optimization strategies
- Security vulnerability analysis
- System design questions

## Installation

The setup script automatically downloads all free models:

```bash
./scripts/bootstrap.sh
```

This will:
1. Install Ollama (if not present) - FREE
2. Download 4 models (~12GB) - FREE
3. Configure the system - FREE

## Can I Use Without Claude API?

**YES!** You can run this system with ONLY free local models:

```bash
# In .env file
ANTHROPIC_API_KEY=none
```

With this configuration:
- Simple tasks → Handled by local models ✅
- Complex tasks → Return error or best-effort local response

## Hardware Requirements

### Minimum
- 16GB RAM
- 20GB free disk space
- macOS (Intel or Apple Silicon)

### Recommended
- 32GB RAM (for faster inference)
- SSD storage
- Apple Silicon M1/M2/M3 (significantly faster)

## Performance on Apple Silicon

Local models run exceptionally fast on Apple Silicon:
- M1/M2/M3 chips have neural engines
- Classification: ~200ms
- Code generation: 1-2 seconds
- No GPU required

## Ollama Architecture

```
Your App
    ↓
Ollama Client (Node.js)
    ↓
Ollama Server (localhost:11434)
    ↓
Local Model (GGUF format)
    ↓
Metal/CPU Inference
    ↓
Response (100% local)
```

## Model Selection Rationale

### llama3.2:3b - Classifier
- **Why:** Fast, accurate classification
- **Strengths:** Low latency, good instruction following
- **Runs in:** ~200-300ms

### llama3.1:8b - Compressor
- **Why:** Balanced performance/quality
- **Strengths:** Good summarization, context understanding
- **Runs in:** ~1-2 seconds

### qwen2.5-coder:7b - Code Editor
- **Why:** Code-specialized model
- **Strengths:** Code syntax, formatting, simple refactoring
- **Runs in:** ~1-3 seconds

### nomic-embed-text - Embeddings
- **Why:** Fast, good quality embeddings
- **Strengths:** Semantic search, code similarity
- **Runs in:** ~50-100ms per embedding

## Verifying Local Setup

Check that models are installed and FREE:

```bash
# List installed models
ollama list

# Should show:
# llama3.2:3b
# llama3.1:8b
# qwen2.5-coder:7b
# nomic-embed-text
```

Test a model locally:

```bash
# This runs 100% locally (no network)
ollama run llama3.2:3b "Say hello"
```

## Cost Comparison

### This System (With Local Models)
- Setup: $0
- Per request: $0 (for 60-80% of requests)
- Claude usage: Only 20-40% of requests
- **Monthly savings:** 70%+ on AI costs

### Without Local Models (All Claude)
- Every request uses Claude API
- 100% of requests incur token costs
- Higher latency (network round-trip)

## Disk Space Management

Models are stored in:
- **macOS:** `~/.ollama/models/`
- **Size:** ~12GB total

To free space:
```bash
# Remove specific model
ollama rm llama3.1:8b

# Reinstall later
ollama pull llama3.1:8b
```

## Updating Models

Models are versioned. To update:

```bash
# Check for updates
ollama list

# Update specific model
ollama pull llama3.2:3b

# Update all
bash scripts/install_models.sh
```

## Troubleshooting

### Models not downloading
```bash
# Check Ollama is running
curl http://localhost:11434/api/version

# Check disk space
df -h

# Retry download
ollama pull llama3.2:3b
```

### Slow inference
- Close other apps (free up RAM)
- Check CPU usage: Activity Monitor
- Consider smaller models if needed

### Model not found
```bash
# Reinstall all models
bash scripts/install_models.sh
```

## Privacy & Security

All local models:
- Run completely offline (after download)
- Never send data to external servers
- Your code stays on your machine
- No telemetry or tracking

## Alternative Free Models

You can swap models in `config/model.config.json`:

### Other Free Classifier Options
- `gemma2:2b` (smaller, faster)
- `phi3:mini` (Microsoft's SLM)

### Other Free Code Models
- `deepseek-coder:6.7b` (specialized coder)
- `codellama:7b` (Meta's code model)

### Other Free Embedding Models
- `mxbai-embed-large` (larger, more accurate)
- `all-minilm` (smaller, faster)

## Resource Monitoring

Monitor local model usage:

```bash
# Watch Ollama logs
tail -f ~/.ollama/logs/server.log

# Monitor resource usage
top | grep ollama
```

## Benefits of Local-First Design

1. **Privacy:** Code never leaves your machine
2. **Cost:** 70%+ reduction in API costs
3. **Speed:** No network latency for simple tasks
4. **Reliability:** Works offline
5. **Control:** Full control over models and data

## Next Steps

1. ✅ Install free models: `./scripts/bootstrap.sh`
2. ✅ Test local execution: `./run.sh`
3. ✅ Monitor with `/stats`
4. ✅ Verify 60-80% local ratio

**You now have a production-ready, FREE local AI system!**
