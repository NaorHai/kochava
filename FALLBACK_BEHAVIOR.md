# Automatic Fallback Behavior

AI Router provides **seamless, automatic fallback** to FREE local models when Claude API is unavailable.

## When Does Fallback Happen?

The system automatically falls back to local models when:

### 1. ❌ Credits Exhausted
```
Claude API Error: Credit limit reached
↓
✅ AUTOMATIC FALLBACK → Local model (FREE)
↓
✅ Request processed successfully
```

### 2. ⏱️ Rate Limit Reached
```
Claude API Error: Too many requests
↓
✅ AUTOMATIC FALLBACK → Local model (FREE)
↓
✅ Request processed successfully
```

### 3. 💰 Session Budget Exceeded
```
Session token budget: 8000/8000 used
↓
✅ AUTOMATIC FALLBACK → Local model (FREE)
↓
✅ Request processed successfully
```

### 4. 🔑 API Key Issues
```
Claude API Key: Invalid or not set
↓
✅ AUTOMATIC FALLBACK → Local model (FREE)
↓
✅ Request processed successfully
```

### 5. 🌐 Network Errors
```
Network Error: Cannot reach Claude API
↓
✅ AUTOMATIC FALLBACK → Local model (FREE)
↓
✅ Request processed successfully
```

## What You'll See

When fallback occurs, you'll receive a **clear notification** at the start of the response:

```
╔════════════════════════════════════════════════════════╗
║              AUTOMATIC FALLBACK TO LOCAL MODEL         ║
╚════════════════════════════════════════════════════════╝

⚠️ Claude API credits exhausted. Falling back to FREE local model.

✅ Your request is being processed by a FREE local model instead.
✅ Quality may be slightly reduced for complex tasks.
✅ No API costs incurred.

Response:

[Your answer here...]
```

## Fallback Quality

| Task Type | Local Model Quality | Notes |
|-----------|-------------------|-------|
| Code formatting | ⭐⭐⭐⭐⭐ Excellent | No quality loss |
| Simple refactoring | ⭐⭐⭐⭐⭐ Excellent | No quality loss |
| Code explanation | ⭐⭐⭐⭐ Very Good | Minimal difference |
| Small edits | ⭐⭐⭐⭐⭐ Excellent | No quality loss |
| Complex debugging | ⭐⭐⭐ Good | May need iteration |
| Architecture design | ⭐⭐⭐ Good | Less comprehensive |
| Multi-file refactor | ⭐⭐⭐ Good | May miss edge cases |

## Configuration

### Enable/Disable Fallback

In `.env`:
```bash
# Enable automatic fallback (default)
AUTO_FALLBACK_ENABLED=true

# Disable fallback (show error instead)
AUTO_FALLBACK_ENABLED=false
```

### Customize Fallback Behavior

Edit `config/fallback.config.json`:

```json
{
  "fallbackBehavior": {
    "enabled": true,
    "showNotifications": true,
    "logFallbacks": true
  },
  "errorHandling": {
    "credits_exhausted": {
      "fallbackToLocal": true,
      "notifyUser": true
    }
  }
}
```

## Monitoring Fallbacks

### View Fallback Statistics

```bash
./run.sh
> /stats
```

Output shows:
```
Total Requests:    100
Local Requests:    85 (85%)
Claude Requests:   10 (10%)
Fallbacks:         5 (5%)
```

### Check Logs

Fallback events are logged to `logs/escalation.log`:

```bash
tail -f logs/escalation.log | grep fallback
```

Example log entry:
```json
{
  "timestamp": "2026-03-02T10:30:00Z",
  "event": "fallback",
  "from": "claude",
  "to": "local_code",
  "reason": "Claude failed: credits_exhausted",
  "taskType": "refactor_small",
  "success": true
}
```

## Fallback Strategy

```
User Request
    ↓
Route to Claude
    ↓
Claude API Call
    ↓
  ERROR?
    ↓
┌─────────────────┐
│ Classify Error  │
├─────────────────┤
│ • Credits gone  │
│ • Rate limit    │
│ • Network issue │
└─────────────────┘
    ↓
Select Best Local Model
    ↓
┌─────────────────────┐
│ Execute Locally     │
│ • local_code        │
│ • local_compress    │
└─────────────────────┘
    ↓
Add Fallback Notice
    ↓
Return Response
```

## Best Practices

### 1. Set Reasonable Token Budget
```bash
# In .env
CLAUDE_TOKEN_BUDGET=8000  # Adjust based on your needs
```

### 2. Monitor Your Usage
```bash
# Check token usage regularly
./run.sh
> /stats
```

### 3. Test Without Claude
```bash
# In .env - simulate no credits
ANTHROPIC_API_KEY=none

# All requests will use local models
./run.sh
> Design a microservices architecture
```

### 4. Plan for Fallback
If you rely on Claude for critical tasks:
- Test local model quality for your use cases
- Consider simplifying complex requests
- Have backup workflows ready

## Examples

### Example 1: Credits Exhausted Mid-Session

```bash
./run.sh

> Explain this function
✅ Response from qwen2.5-coder:7b (FREE)

> Refactor this code
✅ Response from qwen2.5-coder:7b (FREE)

> Design a distributed cache architecture
⚠️ Claude credits exhausted - falling back to local model
✅ Response from llama3.1:8b (FREE)

> Format this code
✅ Response from qwen2.5-coder:7b (FREE)
```

User experience: **Seamless continuation!**

### Example 2: No API Key Set

```bash
# .env
ANTHROPIC_API_KEY=none

./run.sh

> Complex architectural design question
⚠️ Claude API key not configured - using FREE local model
✅ Response from llama3.1:8b (FREE)
```

User experience: **Still works, just with local models!**

### Example 3: Rate Limit Hit

```bash
> [Many requests in quick succession]
...
> Another complex request
⚠️ Claude rate limit reached - falling back to local model
✅ Response from qwen2.5-coder:7b (FREE)
```

User experience: **No interruption!**

## Transparency Guarantee

We ensure **complete transparency** about what's happening:

✅ **Clear notifications** when fallback occurs
✅ **Explicit reason** for fallback (credits, rate limit, etc.)
✅ **Model identification** in every response
✅ **Statistics tracking** (view with `/stats`)
✅ **Detailed logging** for audit trail

## Cost Implications

| Scenario | Cost |
|----------|------|
| Normal operation (60% local, 40% Claude) | ~$10-30/month |
| After credits exhausted | $0/month |
| Fallback to local (100% local) | $0/month |
| Rate limited (temporary) | $0 during fallback |

**Bottom line:** You never lose functionality, you just switch to FREE models!

## Comparison: With vs Without Fallback

### ❌ Without Fallback
```
Claude API Error
↓
❌ Request fails
↓
😞 User gets error message
↓
🔄 User must retry or give up
```

### ✅ With Fallback (Our System)
```
Claude API Error
↓
✅ Automatic fallback to local model
↓
✅ Request processed successfully
↓
😊 User gets response (with notice)
```

## Fallback Performance

| Metric | Local Fallback |
|--------|---------------|
| Success Rate | 95%+ |
| Latency | 1-3 seconds |
| Quality (simple tasks) | ⭐⭐⭐⭐⭐ |
| Quality (complex tasks) | ⭐⭐⭐ |
| Cost | $0 |

## Troubleshooting

### Fallback Not Working?

1. **Check Ollama is running:**
   ```bash
   curl http://localhost:11434/api/version
   ```

2. **Verify models installed:**
   ```bash
   ollama list
   ```

3. **Check fallback config:**
   ```bash
   cat config/fallback.config.json
   ```

4. **Enable fallback:**
   ```bash
   # In .env
   AUTO_FALLBACK_ENABLED=true
   ```

### Too Many Fallbacks?

If you're falling back too often:
- Check your Claude API key is valid
- Verify you have credits remaining
- Review your token budget setting
- Check network connectivity

## Summary

AI Router's automatic fallback ensures you **never lose productivity** when Claude API is unavailable:

✅ **Seamless transition** to FREE local models
✅ **Clear notifications** about what's happening
✅ **Zero downtime** - requests always succeed
✅ **Cost protection** - no surprise bills
✅ **Complete transparency** - you always know which model ran

**Your work continues uninterrupted, always.**
