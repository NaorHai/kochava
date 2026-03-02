# AI Router - Claude Plugin Integration

This document describes how to use AI Router as a Claude plugin.

## Overview

The AI Router plugin allows Claude Desktop to offload simple coding tasks to local models, reducing token consumption and latency for routine operations.

## Installation

1. Start the plugin server:
   ```bash
   npm run plugin
   ```

2. Add to Claude Desktop config:

   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

3. Restart Claude Desktop

## Usage

Once configured, Claude will automatically route appropriate requests through the plugin:

**Example requests handled locally:**
- "Format this code"
- "Explain this function"
- "Rename this variable to camelCase"
- "Add JSDoc comments"

**Example requests escalated to Claude:**
- "Debug why this async operation fails"
- "Design an architecture for a payment system"
- "Refactor this entire module"

## API Endpoint

The plugin exposes a single endpoint:

### POST /route

Routes an AI request through the orchestrator.

**Request:**
```json
{
  "query": "Format this function",
  "code_context": "function foo(){return 1}"
}
```

**Response:**
```json
{
  "response": "Here's the formatted version:\n\nfunction foo() {\n  return 1;\n}",
  "model_used": "qwen2.5-coder:7b",
  "tokens_used": 45,
  "latency_ms": 823,
  "metrics": {
    "totalRequests": 10,
    "localRequests": 8,
    "claudeRequests": 2,
    "tokensSaved": 12450
  }
}
```

## Plugin Manifest

The plugin is discovered via:
- `GET /.well-known/ai-plugin.json` - Plugin manifest
- `GET /openapi.yaml` - OpenAPI specification

## Architecture

```
Claude Desktop
    ↓
AI Router Plugin (Port 3001)
    ↓
Core Orchestrator
    ↓
┌─────────────┬──────────────┐
│ Local Models │  Claude API │
└─────────────┴──────────────┘
```

## Configuration

The plugin uses the same configuration as the CLI and server modes:
- `config/routing.config.json` - Routing rules
- `config/model.config.json` - Model definitions
- `.env` - Environment variables

## Monitoring

Plugin requests are logged to:
- `logs/routing.log` - Routing decisions
- `logs/token_usage.log` - Token consumption

## Troubleshooting

### Plugin not detected by Claude

1. Check plugin server is running: `curl http://localhost:3001/health`
2. Verify manifest is accessible: `curl http://localhost:3001/.well-known/ai-plugin.json`
3. Restart Claude Desktop
4. Check Claude Desktop logs

### Requests not being routed

1. Check `logs/routing.log` for routing decisions
2. Verify Ollama models are installed: `ollama list`
3. Check API key is set in `.env`

### High latency

1. Check if Ollama is running: `curl http://localhost:11434/api/version`
2. Monitor model loading times in logs
3. Consider using smaller models for classification

## Disabling the Plugin

1. Remove plugin entry from Claude Desktop config
2. Restart Claude Desktop
3. Stop the plugin server

## Security Notes

- Plugin runs on localhost only (not accessible externally)
- No authentication required (localhost trust model)
- API key is stored in `.env` (not exposed to network)
- All requests are logged for audit

## Performance

Expected behavior:
- Simple requests: 1-3 seconds (local)
- Complex requests: 3-10 seconds (Claude)
- Token savings: 70%+ on routine tasks

## Advanced Usage

### Custom Port

Change port in `.env`:
```
PLUGIN_PORT=3002
```

Update Claude config with new port.

### Debugging

Enable verbose logging:
```
LOG_LEVEL=debug npm run plugin
```

### Metrics Endpoint

Query usage statistics:
```bash
curl http://localhost:3001/metrics
```

## Limitations

- Requires Ollama to be running locally
- Initial model loading may take 10-30 seconds
- Best suited for coding tasks (not general conversation)
- Plugin mode does not support streaming responses

## Future Enhancements

- Streaming response support
- Multi-user session management
- Remote deployment option
- Fine-tuned routing models
- Custom task type definitions
