# Kochava Command Guide

**Kochava** is your intelligent AI coding assistant that routes between FREE local models and Claude API.

## 🚀 Installation

### Step 1: Install the Project
```bash
cd ~/Documents/Private/ai-router
./scripts/bootstrap.sh
```

### Step 2: Install Global Command
```bash
npm run install-command
```

**That's it!** Now `kochava` works from any directory.

---

## 💬 Usage

### Quick Query (Single Request)
```bash
kochava "format this code: function foo(){return 1}"
```

**Output:**
```
function foo() {
  return 1;
}

[qwen2.5-coder:7b • 45 tokens • 1200ms • FREE]
```

### Interactive Mode (Chat)
```bash
kochava --chat
# or
kochava -c
```

**You'll see:**
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████   ██████   █████  ██   ██  █████  ██    ██     ║
║    ██   ██ ██    ██ ██   ██ ██   ██ ██   ██ ██    ██     ║
║    ███████ ██    ██ ██      ███████ ███████ ██    ██     ║
║    ██   ██ ██    ██ ██   ██ ██   ██ ██   ██  ██  ██      ║
║    ██   ██  ██████   █████  ██   ██ ██   ██   ████       ║
║                                                           ║
║         Intelligent AI Router • Local + Cloud            ║
╚═══════════════════════════════════════════════════════════╝

Type your questions or commands. Use Ctrl+C or type "exit" to quit.

Commands: /stats, /reset, /help, /exit

kochava> _
```

### With Code File Context
```bash
kochava --file mycode.ts "explain this code"
```

### Show Statistics
```bash
kochava --stats
# or
kochava -s
```

**Output:**
```
📊 Usage Statistics

Total Requests:    10
Local (FREE):      8 (80%)
Claude (Cloud):    2 (20%)
Tokens Saved:      12,450
Claude Tokens:     3,200
Avg Latency:       1,650ms

Estimated Savings: $37.35
Claude Cost:       $9.60
```

### Reset Session
```bash
kochava --reset
# or
kochava -r
```

---

## 🎯 Command Examples

### Code Formatting (Local - FREE)
```bash
kochava "format this: function foo(){return 1}"
```

### Code Explanation (Local - FREE)
```bash
kochava "explain how async/await works"
```

### Refactoring (Local - FREE)
```bash
kochava "refactor this to use arrow functions: function add(a,b){return a+b}"
```

### Complex Debugging (Claude or Local with fallback)
```bash
kochava "why does my React component cause infinite renders?"
```

### Architecture Design (Claude or Local with fallback)
```bash
kochava "design a scalable microservices architecture"
```

### With Context File
```bash
kochava --file app.ts "find the bug in this code"
```

---

## 🎮 Interactive Mode Commands

Once in interactive mode (`kochava --chat`):

### Ask Questions
```
kochava> format this: function foo(){return 1}
kochava> explain closures in JavaScript
kochava> debug this async issue
```

### View Stats
```
kochava> /stats
```

### Reset Session
```
kochava> /reset
```

### Get Help
```
kochava> /help
```

### Exit
```
kochava> /exit
# or just press Ctrl+C
```

---

## 📊 Understanding Output

Every response shows:
```
[model-name • tokens • latency • cost]
```

**Examples:**
```
[qwen2.5-coder:7b • 45 tokens • 1200ms • FREE]
└─ Local model, no cost

[llama3.1:8b • 320 tokens • 1800ms • FREE]
└─ Local model, no cost

[claude-sonnet-4 • 450 tokens • 3200ms • ~$0.01-0.05]
└─ Cloud model, minimal cost
```

---

## 🔧 All Command Options

```bash
kochava [options] [query]

Arguments:
  query                Your question or request

Options:
  -c, --chat           Start interactive chat mode
  -i, --interactive    Start interactive chat mode (alias)
  -s, --stats          Show usage statistics
  -r, --reset          Reset session and token counters
  -v, --verbose        Enable verbose output
  --file <path>        Load code context from file
  --no-color           Disable colored output
  --version            Show version number
  --help               Show help
```

---

## 🌟 Claude-like Experience

Kochava is designed to feel like the Claude CLI:

| Feature | Kochava | Claude CLI |
|---------|---------|------------|
| Single queries | ✅ `kochava "query"` | ✅ `claude "query"` |
| Interactive mode | ✅ `kochava --chat` | ✅ `claude --chat` |
| Stats | ✅ `kochava --stats` | ✅ `claude --stats` |
| File context | ✅ `kochava --file` | ✅ `claude --file` |
| Colored output | ✅ Beautiful colors | ✅ Beautiful colors |
| Works anywhere | ✅ Global command | ✅ Global command |

**Plus, Kochava adds:**
- 🆓 **60-80% requests FREE** (local models)
- 💰 **70%+ cost savings**
- 🔄 **Automatic fallback** when credits run out
- 📊 **Detailed statistics**
- 🔒 **Privacy-first** (local execution)

---

## 💡 Pro Tips

### Tip 1: Use Chat Mode for Sessions
```bash
kochava --chat
# Work for hours with context maintained
```

### Tip 2: Check Stats Regularly
```bash
kochava --stats
# See how much you're saving!
```

### Tip 3: File Context for Large Code
```bash
kochava --file mycode.ts "refactor this"
# Better than pasting into terminal
```

### Tip 4: Pipe Input
```bash
cat mycode.ts | kochava "explain this code"
# Works with pipes!
```

### Tip 5: Verbose for Debugging
```bash
kochava -v "your query"
# See what's happening behind the scenes
```

---

## 🔄 Daily Workflow

### Morning: Start Chat Session
```bash
kochava --chat
```

### Throughout Day: Quick Queries
```bash
kochava "format this code"
kochava "explain async/await"
kochava --file bug.ts "find the issue"
```

### End of Day: Check Savings
```bash
kochava --stats
```

---

## 🛠️ Troubleshooting

### Command Not Found
```bash
# Reinstall
cd ~/Documents/Private/ai-router
npm run install-command
```

### Models Not Available
```bash
# Check Ollama
curl http://localhost:11434/api/version

# Restart Ollama
open /Applications/Ollama.app
```

### Update After Changes
```bash
cd ~/Documents/Private/ai-router
npm run build
npm run install-command
```

---

## 🗑️ Uninstall

To remove the global command:
```bash
cd ~/Documents/Private/ai-router
npm run uninstall-command
```

---

## 📚 More Information

- Full docs: `~/Documents/Private/ai-router/README.md`
- Architecture: `~/Documents/Private/ai-router/ARCHITECTURE.md`
- Local models: `~/Documents/Private/ai-router/LOCAL_MODELS.md`

---

## ✨ Example Session

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

kochava> explain how this works

This is a simple function that takes no parameters and returns
the numeric value 1. It's using the function keyword to declare
a named function called 'foo'...

[llama3.1:8b • 180 tokens • 1600ms • FREE]

kochava> /stats

📊 Usage Statistics

Total Requests:    2
Local (FREE):      2 (100%)
Claude (Cloud):    0 (0%)
Tokens Saved:      337
Claude Tokens:     0
Avg Latency:       1,400ms

Estimated Savings: $1.01
Claude Cost:       $0.00

kochava> /exit

Goodbye! 👋
```

---

**Kochava: Smart routing, massive savings, zero interruption.** 🚀
