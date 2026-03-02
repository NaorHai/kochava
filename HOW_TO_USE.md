# How To Use AI Router - Step by Step

## 📦 Installation (First Time Only)

### Step 1: Navigate to Project
```bash
cd ~/Documents/Private/kochava
```

### Step 2: Run Bootstrap (One Command Does Everything!)
```bash
./scripts/bootstrap.sh
```

**What happens:**
- ✅ Installs Ollama (FREE local AI server)
- ✅ Downloads 4 FREE models (~12GB, takes 10-20 minutes)
- ✅ Installs dependencies
- ✅ Builds the project
- ✅ Runs verification tests

**You'll be asked for API key:**
- Press `Enter` to skip = Run with FREE local models only
- OR paste your Claude API key = Enable complex reasoning

**That's it! Installation done.**

---

## 🚀 Running the System

### Option 1: Interactive CLI (Most Common)

```bash
cd ~/Documents/Private/kochava
./run.sh
```

**You'll see:**
```
🤖 AI Router - Interactive Mode

Commands: /stats, /reset, /quit, /help

> _
```

**Now just type your requests!**

---

## 💬 Usage Examples

### Example 1: Format Code
```bash
> Format this code: function foo(){return 1}
```

**Response:**
```
function foo() {
  return 1;
}

[qwen2.5-coder:7b | 45 tokens | 1200ms]
```

### Example 2: Explain Code
```bash
> Explain how async/await works in JavaScript
```

**Response:**
```
Async/await is a syntax for handling asynchronous operations...

[llama3.1:8b | 320 tokens | 1800ms]
```

### Example 3: Debug Complex Issue
```bash
> Why does my React component re-render infinitely?
```

**Response:**
```
Looking at common causes of infinite re-renders...

[claude-sonnet-4 | 450 tokens | 3200ms]
```
(Uses Claude if API key set, otherwise uses local model)

### Example 4: Add Code Context
```bash
> Refactor this function to use async/await:
>
> function getData() {
>   return fetch('/api').then(r => r.json());
> }
```

**Response:**
```
Here's the refactored version using async/await:

async function getData() {
  const response = await fetch('/api');
  return await response.json();
}

[qwen2.5-coder:7b | 78 tokens | 1500ms]
```

---

## 🎮 Built-in Commands

### Check Statistics
```bash
> /stats
```

**Shows:**
```
📊 Usage Statistics

Total Requests:    10
Local Requests:    8 (80%)
Claude Requests:   2 (20%)
Tokens Saved:      12,450
Claude Tokens:     3,200
Avg Latency:       1,650ms
```

### Reset Session
```bash
> /reset
```
Clears conversation history and token counters.

### Get Help
```bash
> /help
```
Shows available commands.

### Exit
```bash
> /quit
```
or just press `Ctrl+C`

---

## 🌐 Option 2: HTTP Server Mode

### Start Server
```bash
cd ~/Documents/Private/kochava
npm run server
```

**Server starts on:** `http://localhost:3000`

### Make API Calls

**Process a query:**
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Format this code: function foo(){return 1}"
  }'
```

**Response:**
```json
{
  "success": true,
  "response": {
    "content": "function foo() {\n  return 1;\n}",
    "model": "qwen2.5-coder:7b",
    "tokens": 45,
    "latency": 1200
  }
}
```

**With code context:**
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Explain this function",
    "context": "function calculate(a, b) { return a + b; }"
  }'
```

**Get metrics:**
```bash
curl http://localhost:3000/api/metrics
```

**Server endpoints:**
- `POST /api/process` - Process a query
- `POST /api/index` - Index codebase
- `GET /api/metrics` - Get statistics
- `POST /api/reset` - Reset session
- `GET /health` - Health check

---

## 🔌 Option 3: Claude Plugin Mode

### Start Plugin Server
```bash
cd ~/Documents/Private/kochava
npm run plugin
```

**Server starts on:** `http://localhost:3001`

### Configure Claude Desktop

**macOS:** Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** Edit `%APPDATA%\Claude\claude_desktop_config.json`

Add:
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

Restart Claude Desktop, and it will automatically route simple requests through local models!

---

## 🎯 What Runs Where?

### Handled by LOCAL Models (FREE)
- ✅ Code formatting
- ✅ Simple refactoring
- ✅ Variable renaming
- ✅ Adding comments
- ✅ Explaining code
- ✅ Import organization
- ✅ Style fixes

**Cost:** $0
**Speed:** 1-3 seconds

### Handled by CLAUDE (Optional)
- ⚡ Complex debugging
- ⚡ Architecture design
- ⚡ Multi-file refactoring
- ⚡ Deep code analysis
- ⚡ Security reviews

**Cost:** $0.01-0.05 per request
**Speed:** 3-10 seconds

---

## 📊 Monitoring Your Usage

### Real-Time Stats (CLI)
```bash
> /stats
```

### Check Logs
```bash
# Routing decisions
tail -f ~/Documents/Private/kochava/logs/routing.log

# Token usage
tail -f ~/Documents/Private/kochava/logs/token_usage.log

# Fallback events
tail -f ~/Documents/Private/kochava/logs/escalation.log
```

### View Metrics (Server Mode)
```bash
curl http://localhost:3000/api/metrics | jq
```

---

## 🛠️ Common Workflows

### Workflow 1: Morning Coding Session
```bash
cd ~/Documents/Private/kochava
./run.sh

> Format this: function foo(){return 1}
> Explain how this works: [paste code]
> Refactor to use async/await
> /stats
> /quit
```

### Workflow 2: Debug Complex Issue
```bash
./run.sh

> I have a memory leak in my React app. [paste code]
> Why does this component re-render?
> How can I optimize this?
> /quit
```

### Workflow 3: Integrate with Scripts
```bash
# Single query
./run.sh query "Format this code" --context myfile.ts

# Process file
cat myfile.ts | ./run.sh query "Explain this code"
```

---

## ⚙️ Configuration

### Adjust Token Budget
Edit `~/.claude/projects/-Users-nhaimov/Documents/Private/ai-router/.env`:
```bash
CLAUDE_TOKEN_BUDGET=8000  # Increase for longer sessions
```

### Change Models
Edit `~/Documents/Private/kochava/config/model.config.json`:
```json
{
  "models": {
    "codeEditor": {
      "name": "deepseek-coder:6.7b"  // Use different model
    }
  }
}
```

### Disable Claude Completely
```bash
# In .env
ANTHROPIC_API_KEY=none
```

All requests will use local models only.

---

## 🔧 Troubleshooting

### Issue: `./run.sh` command not found
```bash
cd ~/Documents/Private/kochava
chmod +x run.sh scripts/*.sh
./run.sh
```

### Issue: Models not found
```bash
# Check Ollama is running
curl http://localhost:11434/api/version

# Start Ollama (macOS)
open /Applications/Ollama.app

# Reinstall models
bash scripts/install_models.sh
```

### Issue: Build errors
```bash
cd ~/Documents/Private/kochava
rm -rf dist node_modules
npm install
npm run build
```

### Issue: Slow responses
- Close other apps to free RAM
- Check CPU usage in Activity Monitor
- Consider using smaller models (edit config)

### Issue: API key not working
```bash
# Edit .env file
nano ~/Documents/Private/kochava/.env

# Add your key
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Restart
./run.sh
```

---

## 📈 Performance Tips

### Tip 1: Use Local Models First
Most tasks (80%) work great with local models. Try local first!

### Tip 2: Simplify Complex Requests
Break down complex questions into smaller parts.

### Tip 3: Monitor Token Usage
Check `/stats` regularly to see your savings.

### Tip 4: Adjust Routing Rules
Edit `config/routing.config.json` to tune routing behavior.

---

## 🎓 Learning the System

### Day 1: Basic Usage
- Install with `./scripts/bootstrap.sh`
- Try simple requests
- Check `/stats` to see local routing

### Day 2: Explore Commands
- Use `/stats`, `/reset`, `/help`
- Try different task types
- Observe which uses Claude vs local

### Day 3: Advanced Usage
- Run server mode
- Monitor logs
- Customize configuration

### Week 2: Optimization
- Tune routing rules
- Adjust complexity thresholds
- Monitor cost savings

---

## 💡 Pro Tips

### Tip 1: Context is King
Provide code context for better results:
```bash
> Refactor this:
>
> [paste entire function]
```

### Tip 2: Check What Model Ran
Every response shows the model used. Learn which tasks go where.

### Tip 3: Use Server Mode for Integration
Integrate with your IDE, scripts, or tools via the HTTP API.

### Tip 4: Monitor Fallbacks
If Claude fails, you'll see a fallback notice. Everything still works!

### Tip 5: Save Money
Check `/stats` daily. You'll see massive token savings!

---

## 🚀 Quick Reference

```bash
# Install
cd ~/Documents/Private/kochava && ./scripts/bootstrap.sh

# Run CLI
./run.sh

# Run Server
npm run server

# Run Plugin
npm run plugin

# Single Query
./run.sh query "your question"

# Stats
./run.sh
> /stats

# Reset
> /reset

# Quit
> /quit
```

---

## 📚 Need More Help?

- Full docs: `less README.md`
- Architecture: `less ARCHITECTURE.md`
- Quick start: `less QUICKSTART.md`
- Local models: `less LOCAL_MODELS.md`
- Fallback info: `less FALLBACK_BEHAVIOR.md`

---

## ✨ That's It!

You're ready to use AI Router. Start with:

```bash
cd ~/Documents/Private/kochava
./run.sh
```

And just ask questions! The system handles everything else automatically.

**Your AI coding assistant is ready. Let's code! 🚀**
