# Docker Quick Start - 3 Commands

## Install and Run with Docker

```bash
# 1. Clone
git clone https://github.com/NaorHai/kochava.git
cd kochava

# 2. Setup (downloads models, ~15-20 min)
./scripts/docker-setup.sh

# 3. Use it!
docker-compose run --rm kochava "format this: function foo(){return 1}"
```

## Common Commands

```bash
# Single query
docker-compose run --rm kochava "your question"

# Show stats
docker-compose run --rm kochava --stats

# Start HTTP server
docker-compose --profile server up -d

# Start plugin server
docker-compose --profile plugin up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

## Update Models

```bash
docker-compose exec ollama ollama list
docker-compose exec ollama ollama pull llama3.2:3b
```

## Full Documentation

See `README_DOCKER.md` for complete Docker guide.

---

**That's it! Zero local dependencies, everything in Docker.** 🐳
