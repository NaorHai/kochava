# Run Kochava Locally - Step by Step

## 🚀 Quick Start (5 Minutes)

### Step 1: Navigate to Project
```bash
cd ~/Documents/Private/kochava
```

### Step 2: Run Bootstrap (Installs Everything)
```bash
./scripts/bootstrap.sh
```

**What this does:**
- ✅ Installs Ollama (FREE local AI server)
- ✅ Downloads 4 FREE models (~12GB, takes 10-20 min)
- ✅ Installs npm dependencies
- ✅ Builds TypeScript
- ✅ Runs verification tests
- ✅ Prompts for optional Claude API key

**Time:** 15-20 minutes (mostly downloading models)

### Step 3: Install Global Command
```bash
npm run install-command
```

This installs the `kochava` command globally so you can use it from anywhere.

### Step 4: Test It!
```bash
kochava "format this: function foo(){return 1}"
```

**You should see:**
```
function foo() {
  return 1;
}

[qwen2.5-coder:7b • 45 tokens • 1200ms • FREE]
```

---

## 🎯 If You Just Cloned from GitHub

```bash
# 1. Clone the repo
git clone https://github.com/NaorHai/kochava.git
cd kochava

# 2. Run bootstrap (installs everything)
./scripts/bootstrap.sh

# 3. Install global command
npm run install-command

# 4. Use it!
kochava --chat
```

---

## 💬 Usage Modes

### Interactive Mode (Recommended)
```bash
kochava --chat
# or
kochava -c
```

Type your questions and get instant answers!

### Single Query
```bash
kochava "explain async/await in JavaScript"
```

### With File Context
```bash
kochava --file mycode.ts "find the bug"
```

### Show Statistics
```bash
kochava --stats
```

---

## 🔧 Troubleshooting

### Issue: Models not downloading
```bash
# Check Ollama is running
curl http://localhost:11434/api/version

# Start Ollama
open /Applications/Ollama.app

# Wait 5 seconds, then retry
./scripts/install_models.sh
```

### Issue: Command not found
```bash
cd ~/Documents/Private/kochava
npm run build
npm run install-command
```

### Issue: Permission denied
```bash
chmod +x scripts/*.sh run.sh
```

### Issue: npm install fails
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Verify Installation

Run this to check everything is working:

```bash
cd ~/Documents/Private/kochava
bash scripts/verify.sh
```

**Should show:**
```
✓ Ollama is accessible
✓ llama3.2:3b is installed
✓ llama3.1:8b is installed
✓ qwen2.5-coder:7b is installed
✓ nomic-embed-text is installed
✓ .env file exists
✓ Build directory exists
✓ Classifier model responds
```

---

## 🌐 Alternative: Run Without Global Install

If you don't want to install globally:

```bash
cd ~/Documents/Private/kochava

# Interactive mode
./run.sh

# Single query
./run.sh query "your question"

# HTTP server
npm run server

# Claude plugin
npm run plugin
```

---

## 💰 Cost Setup

### Option 1: FREE Only (No API Key)
```bash
# During bootstrap, press Enter when asked for API key
# OR edit .env:
ANTHROPIC_API_KEY=none
```

**Result:** 100% FREE, all local models

### Option 2: Hybrid (Recommended)
```bash
# During bootstrap, paste your Claude API key
# OR edit .env:
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Result:** 60-80% FREE local, 20-40% Claude for complex tasks

---

## 📈 Monitor Your Usage

```bash
# Real-time stats
kochava --stats

# View logs
tail -f ~/Documents/Private/kochava/logs/routing.log

# Check token usage
cat ~/Documents/Private/kochava/logs/token_usage.log | jq
```

---

## 🔄 Daily Workflow

### Morning
```bash
kochava --chat
# Start your coding session
```

### Throughout Day
```bash
# Quick questions
kochava "format this code"
kochava "explain this function"
kochava --file bug.ts "find the issue"
```

### End of Day
```bash
# Check savings
kochava --stats
```

---

## 🎓 Example First Session

```bash
$ kochava --chat

╔═══════════════════════════════════════════════════════════╗
║                      KOCHAVA                              ║
║         Intelligent AI Router • Local + Cloud            ║
╚═══════════════════════════════════════════════════════════╝

kochava> format this: function foo(){return 1}

function foo() {
  return 1;
}

[qwen2.5-coder:7b • 45 tokens • 1200ms • FREE]

kochava> explain how closures work

Closures in JavaScript are functions that have access to variables
from their outer (enclosing) function scope, even after the outer
function has finished executing...

[llama3.1:8b • 280 tokens • 2100ms • FREE]

kochava> /stats

📊 Usage Statistics

Total Requests:    2
Local (FREE):      2 (100%)
Claude (Cloud):    0 (0%)
Tokens Saved:      487
Estimated Savings: $1.46

kochava> /exit
Goodbye! 👋
```

---

## 🚨 Common First-Time Issues

### 1. "Ollama not responding"
```bash
# Install Ollama if missing
brew install ollama
# OR download from https://ollama.ai

# Start it
open /Applications/Ollama.app

# Verify
curl http://localhost:11434/api/version
```

### 2. "Models not found"
```bash
cd ~/Documents/Private/kochava
./scripts/install_models.sh
```

### 3. "Build errors"
```bash
# Check Node version (need 18+)
node -v

# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### 4. "kochava command not found"
```bash
cd ~/Documents/Private/kochava
npm run install-command

# If that fails, check if in PATH
which kochava

# Manual check
ls -la /usr/local/bin/kochava
```

---

## 📚 Documentation

- **This file:** Quick local setup
- **README.md:** Complete documentation
- **KOCHAVA_GUIDE.md:** Full command guide
- **QUICKSTART.md:** 5-minute overview
- **LOCAL_MODELS.md:** FREE models explained
- **FALLBACK_BEHAVIOR.md:** Fallback guide

---

## ✨ Success Checklist

After running locally, verify:

- [ ] `kochava --help` works
- [ ] `kochava "test"` returns a response
- [ ] Response shows model name (e.g., qwen2.5-coder:7b)
- [ ] `kochava --stats` shows statistics
- [ ] `ollama list` shows 4 models
- [ ] Logs appear in `~/Documents/Private/kochava/logs/`

**If all checked: You're ready to code! 🚀**

---

## 🔗 Links

- **GitHub:** https://github.com/NaorHai/kochava
- **Issues:** https://github.com/NaorHai/kochava/issues
- **Ollama:** https://ollama.ai
- **Claude API:** https://console.anthropic.com/

---

## 💡 Pro Tips

1. **Use chat mode for sessions:**
   ```bash
   kochava --chat
   ```

2. **Check stats regularly:**
   ```bash
   kochava --stats
   ```

3. **Run in background for server:**
   ```bash
   npm run server &
   ```

4. **Tail logs for debugging:**
   ```bash
   tail -f logs/routing.log
   ```

5. **Update regularly:**
   ```bash
   git pull origin main
   npm install
   npm run build
   npm run install-command
   ```

---

**Need help?** Check the logs or open an issue on GitHub!

**Happy coding with Kochava! 🚀**
