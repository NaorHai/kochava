# Kochava - Docker Installation Guide

Run Kochava with **zero local dependencies** using Docker! Everything runs in containers including Ollama and all models.

## 🚀 Quick Start (3 Commands)

```bash
git clone https://github.com/NaorHai/kochava.git
cd kochava
./scripts/docker-setup.sh
```

That's it! Docker will handle everything.

---

## 📋 Prerequisites

- **Docker Desktop** installed ([download here](https://www.docker.com/products/docker-desktop))
- **20GB free disk space** (for models)
- **macOS, Linux, or Windows**

---

## 🐳 What Gets Dockerized

### Container 1: Ollama
- Runs all FREE local models
- llama3.2:3b, llama3.1:8b, qwen2.5-coder:7b, nomic-embed-text
- Persistent storage volume
- Auto-restart

### Container 2: Kochava App
- Node.js application
- TypeScript compiled
- Routing engine
- CLI interface

### Container 3: HTTP Server (Optional)
- REST API on port 3000
- Process coding requests via HTTP
- JSON responses

### Container 4: Claude Plugin (Optional)
- Plugin server on port 3001
- Claude Desktop integration
- OpenAPI specification

---

## 🛠️ Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/NaorHai/kochava.git
cd kochava
```

### Step 2: Run Setup
```bash
./scripts/docker-setup.sh
```

This will:
1. ✅ Check Docker is installed
2. ✅ Build containers
3. ✅ Start Ollama
4. ✅ Download 4 FREE models (~12GB)
5. ✅ Verify installation

**Time:** 15-20 minutes (mostly downloads)

### Step 3: Configure API Key (Optional)
```bash
# Edit .env file
nano .env

# Add your Claude API key (or leave as 'none')
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

---

## 💬 Usage

### Single Query
```bash
docker-compose run --rm kochava "format this: function foo(){return 1}"
```

**Response:**
```
function foo() {
  return 1;
}

[qwen2.5-coder:7b • 45 tokens • 1200ms • FREE]
```

### Interactive Chat (Coming Soon)
```bash
docker-compose run --rm -it kochava --chat
```

### With File Context
```bash
docker-compose run --rm -v $(pwd)/mycode.ts:/app/input.ts kochava --file /app/input.ts "explain this"
```

### Show Statistics
```bash
docker-compose run --rm kochava --stats
```

---

## 🌐 Server Mode

### Start HTTP Server
```bash
docker-compose --profile server up -d
```

Server runs on: **http://localhost:3000**

### Test Server
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"input": "format this: function foo(){return 1}"}'
```

### Stop Server
```bash
docker-compose --profile server down
```

---

## 🔌 Plugin Mode

### Start Plugin Server
```bash
docker-compose --profile plugin up -d
```

Plugin runs on: **http://localhost:3001**

### Configure Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "plugins": [
    {"url": "http://localhost:3001", "enabled": true}
  ]
}
```

### Stop Plugin
```bash
docker-compose --profile plugin down
```

---

## 🔧 Docker Commands

### View Running Containers
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ollama
docker-compose logs -f kochava
```

### Stop All Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild After Code Changes
```bash
docker-compose build
docker-compose up -d
```

---

## 📊 Check Models

### List Installed Models
```bash
docker-compose exec ollama ollama list
```

**Should show:**
```
NAME                ID              SIZE
llama3.2:3b        a80c4f17acd5    2.0 GB
llama3.1:8b        f66fc8dc39ea    4.7 GB
qwen2.5-coder:7b   c0547d489ab1    4.7 GB
nomic-embed-text   f02dd72bb242    274 MB
```

### Download Additional Models
```bash
docker-compose exec ollama ollama pull deepseek-coder:6.7b
```

### Remove Model
```bash
docker-compose exec ollama ollama rm llama3.1:8b
```

---

## 🗂️ Data Persistence

### Volumes
```bash
# View volumes
docker volume ls | grep kochava

# Inspect Ollama data
docker volume inspect kochava-ollama-data

# Backup volume
docker run --rm -v kochava-ollama-data:/data -v $(pwd):/backup alpine tar czf /backup/ollama-backup.tar.gz /data
```

### Logs
Logs are mounted to `./logs/` on your host:
```bash
tail -f logs/routing.log
tail -f logs/token_usage.log
```

---

## 🧹 Cleanup

### Remove Containers (Keep Data)
```bash
docker-compose down
```

### Remove Everything (Including Models)
```bash
docker-compose down -v
```

### Remove Images
```bash
docker-compose down --rmi all
```

### Full Cleanup
```bash
docker-compose down -v --rmi all
docker volume rm kochava-ollama-data
```

---

## 🔄 Update Kochava

```bash
git pull origin main
docker-compose build
docker-compose up -d
```

---

## ⚙️ Environment Variables

Edit `.env`:

```bash
# Claude API
ANTHROPIC_API_KEY=none          # or your API key

# Token Budget
CLAUDE_TOKEN_BUDGET=8000

# Auto Fallback
AUTO_FALLBACK_ENABLED=true

# Logging
LOG_LEVEL=info

# Ports
SERVER_PORT=3000
PLUGIN_PORT=3001
```

---

## 🚨 Troubleshooting

### Issue: Docker not starting
```bash
# Check Docker is running
docker info

# Start Docker Desktop
open -a Docker  # macOS
```

### Issue: Port already in use
```bash
# Change ports in docker-compose.yml
ports:
  - "3002:3000"  # Use 3002 instead of 3000
```

### Issue: Ollama not responding
```bash
# Check Ollama logs
docker-compose logs ollama

# Restart Ollama
docker-compose restart ollama

# Verify health
docker-compose exec ollama curl http://localhost:11434/api/version
```

### Issue: Models not downloading
```bash
# Retry download
./scripts/docker-models-download.sh

# Manual download
docker-compose exec ollama ollama pull llama3.2:3b
```

### Issue: Container build fails
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📈 Performance

### Resource Usage
- **CPU:** 2-4 cores recommended
- **RAM:** 8GB minimum, 16GB recommended
- **Disk:** 20GB (mostly models)

### Check Resource Usage
```bash
docker stats
```

### Limit Resources (Optional)
Edit `docker-compose.yml`:
```yaml
services:
  ollama:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 8G
```

---

## 🎯 Docker vs Native Installation

| Feature | Docker | Native |
|---------|--------|--------|
| Setup complexity | ⭐⭐⭐⭐⭐ Easy | ⭐⭐⭐ Medium |
| Disk space | Same (~12GB) | Same (~12GB) |
| Performance | Good | Excellent |
| Portability | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐⭐ Good |
| Updates | Easy | Easy |
| Cleanup | Easy | Manual |

---

## 🔐 Security

### Network Isolation
All services run in `kochava-network`. Only exposed ports are accessible.

### Volume Permissions
```bash
# Check volume permissions
docker-compose exec ollama ls -la /root/.ollama
```

### API Key Protection
`.env` file is mounted read-only into containers.

---

## 🚀 Production Deployment

### Using Docker Compose in Production
```bash
# Production compose file
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables
```bash
# Set via environment
ANTHROPIC_API_KEY=your-key docker-compose up -d
```

### Logging
```bash
# Configure log rotation
docker-compose logs --tail=100 -f
```

---

## 📚 More Information

- **Main README:** `README.md`
- **Architecture:** `ARCHITECTURE.md`
- **Local Setup:** `RUN_LOCALLY.md`
- **Kochava Guide:** `KOCHAVA_GUIDE.md`

---

## ✨ Benefits of Docker Setup

✅ **Zero local dependencies** - Everything in containers
✅ **Consistent environment** - Works same everywhere
✅ **Easy cleanup** - Remove everything with one command
✅ **Portable** - Run on any OS with Docker
✅ **Isolated** - No conflicts with system
✅ **Reproducible** - Same setup every time

---

**Docker setup complete! Start coding with Kochava in containers! 🐳**
