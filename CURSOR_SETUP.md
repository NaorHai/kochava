# Cursor Integration Setup

Kochava now supports **3-tier smart routing** to maximize cost efficiency while maintaining quality:

## 🎯 Routing Hierarchy

| Tier | Model | Complexity | Cost | Use Case |
|------|-------|-----------|------|----------|
| **1** | Ollama (local) | 1-3 | Free | Simple queries, code formatting, explanations |
| **2** | Cursor (cloud) | 4-7 | Licensed (already paid for) | Medium complexity, refactoring, debugging |
| **3** | Claude (cloud) | 8-10 | Pay-per-use | Complex reasoning, architecture, multi-file |

## 🚀 Quick Setup

### Option 1: Use Your Cursor License (Recommended)

If you have a Cursor license, Kochava can leverage it as a middle tier:

```bash
# Set your Cursor API key (if using Cursor's API directly)
export CURSOR_API_KEY="your-cursor-api-key"

# OR use the same Claude API key (Cursor supports Claude models)
# Kochava will automatically use ANTHROPIC_API_KEY if CURSOR_API_KEY is not set
```

### Option 2: Use Claude Endpoint (Fallback)

If you don't have direct Cursor API access, Kochava will use the Claude API for the Cursor tier:

```bash
# Just use your existing Claude API key
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Cursor tier will use Claude models but tracked separately for metrics
```

## 📊 How It Works

**Automatic Smart Routing:**

```
Simple query (complexity 1-3)
  └─> Ollama (free, local, fast)

Medium query (complexity 4-7)
  └─> Cursor (licensed, cloud, capable)

Complex query (complexity 8-10)
  └─> Claude (premium, cloud, best-in-class)
```

**Fallback Chain:**

```
Ollama fails ───> Cursor ───> Claude
   (free)      (licensed)    (premium)
```

## 🧪 Testing

Test the 3-tier routing:

```bash
# Test Tier 1 (Ollama) - Simple query
echo "explain this code: function add(a, b) { return a + b; }" | kochava

# Test Tier 2 (Cursor) - Medium complexity
echo "refactor this function to use async/await and add error handling" | kochava

# Test Tier 3 (Claude) - High complexity
echo "design a scalable microservices architecture for a social media platform" | kochava
```

## 📈 Benefits

1. **Cost Savings**: Use free Ollama for 60-70% of queries
2. **License Leverage**: Utilize existing Cursor license for 20-25% of queries
3. **Quality**: Reserve Claude (pay-per-use) for only the most complex 5-10% of queries
4. **Smart Fallback**: Automatic escalation if a lower tier fails

## 🔧 Configuration

### Custom Complexity Thresholds

Edit `.env` to customize routing thresholds:

```bash
# Complexity thresholds (1-10 scale)
COMPLEXITY_THRESHOLD_CURSOR=4   # Route to Cursor at complexity 4+
COMPLEXITY_THRESHOLD_CLAUDE=8   # Route to Claude at complexity 8+
```

### Force a Specific Tier

```bash
# Force Ollama (local)
kochava --model local "your query"

# Force Cursor (if you want to test it)
kochava --model cursor "your query"

# Force Claude
kochava --model claude "your query"
```

## 📊 Metrics

View your routing statistics:

```bash
kochava /stats
```

Output:
```
Total Requests: 100
  - Local (Ollama): 65 (65%)
  - Cursor: 25 (25%)
  - Claude: 10 (10%)

Tokens Saved: 45,000 (vs all-Claude)
Cost Savings: ~$54 (estimated)
```

## 🐛 Troubleshooting

**Cursor not being used:**
- Check if `CURSOR_API_KEY` is set: `echo $CURSOR_API_KEY`
- Verify Cursor is available: Test with `--model cursor`
- Check logs: `LOG_LEVEL=debug kochava "test query"`

**Everything routing to Claude:**
- Your queries might be high complexity
- Check complexity scores in logs
- Adjust thresholds in `.env`

**Cursor failing:**
- Verify API key is valid
- Check network connectivity
- Kochava will auto-fallback to Claude

## 🎓 Advanced

### Custom Cursor Endpoint

If you're using a custom Cursor deployment:

```bash
export CURSOR_BASE_URL="https://your-cursor-endpoint.com"
export CURSOR_MODEL="claude-3-5-sonnet-20241022"
```

### Disable Cursor Tier

To use only Ollama + Claude (skip Cursor):

```bash
# Set complexity threshold high so it always skips Cursor
export COMPLEXITY_THRESHOLD_CURSOR=99
```

## 💡 Best Practices

1. **Let the router decide**: Don't force models unless testing
2. **Monitor metrics**: Run `/stats` regularly to optimize thresholds
3. **Adjust for your use case**: Tune thresholds based on your query patterns
4. **Use skills**: Skills execute locally and bypass all tiers

## 📚 Examples

See `examples/3-tier-routing.md` for real-world examples of how queries route across the 3 tiers.
