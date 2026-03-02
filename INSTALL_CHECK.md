# Installation Checklist

Run this checklist after installation to verify everything is working.

## ✅ Pre-Installation Check

- [ ] macOS operating system
- [ ] Node.js 18 or higher installed (`node -v`)
- [ ] Terminal access
- [ ] 20GB free disk space (for models)
- [ ] Anthropic API key ready

## ✅ Run Bootstrap

```bash
cd ~/Documents/Private/ai-router
./scripts/bootstrap.sh
```

Expected output:
- [x] Ollama installed or already present
- [x] 4 models downloaded successfully
- [x] npm dependencies installed
- [x] TypeScript compiled
- [x] Verification tests passed

## ✅ Post-Installation Verification

### 1. Check Ollama
```bash
curl http://localhost:11434/api/version
ollama list
```

Should show:
- llama3.2:3b
- llama3.1:8b
- qwen2.5-coder:7b
- nomic-embed-text

### 2. Check Environment
```bash
cat .env | grep ANTHROPIC_API_KEY
```

Should show your API key (not "your_api_key_here")

### 3. Check Build
```bash
ls -la dist/
```

Should show compiled JavaScript files

### 4. Test CLI
```bash
./run.sh query "test"
```

Should return a response without errors

### 5. Test Stats
```bash
./run.sh
> /stats
> /quit
```

Should show usage statistics

### 6. Check Logs
```bash
ls -la logs/
```

Should show routing.log, token_usage.log, escalation.log

## ✅ Optional: Test Server Mode

```bash
# Terminal 1
npm run server

# Terminal 2
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"input": "test"}'
```

Should return JSON response

## ✅ Optional: Test Plugin Mode

```bash
npm run plugin
curl http://localhost:3001/.well-known/ai-plugin.json
```

Should return plugin manifest

## ✅ Troubleshooting

If any check fails:

1. **Ollama issues**
   ```bash
   open /Applications/Ollama.app
   sleep 5
   bash scripts/install_models.sh
   ```

2. **Build issues**
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build
   ```

3. **API key issues**
   ```bash
   nano .env
   # Add: ANTHROPIC_API_KEY=sk-ant-...
   ```

4. **Permission issues**
   ```bash
   chmod +x scripts/*.sh run.sh
   ```

## ✅ Success Criteria

All of these should be true:
- [ ] `./run.sh` starts without errors
- [ ] Local requests show model like `qwen2.5-coder:7b`
- [ ] `/stats` shows local request ratio > 0%
- [ ] Logs are being written to `logs/` directory
- [ ] `bash scripts/verify.sh` passes all tests

## 🎉 You're Ready!

If all checks pass, the system is fully operational.

Try these commands:
```bash
./run.sh
> Format this: function foo(){return 1}
> Explain how async/await works
> /stats
```

See README.md for full documentation.
