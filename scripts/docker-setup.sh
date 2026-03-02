#!/bin/bash

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║       Kochava Docker Setup - Complete Installation     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Please install Docker Desktop:"
  echo "   https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "❌ docker-compose not found. Please install Docker Compose."
  exit 1
fi

echo "✓ Docker is installed"
echo ""

# Create .env if doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  echo "✓ .env created"
  echo ""
  echo "⚠️  Edit .env to add your ANTHROPIC_API_KEY (or leave as 'none' for local-only)"
  echo ""
fi

# Build containers
echo "🏗️  Building Docker containers..."
docker-compose build
echo "✓ Containers built"
echo ""

# Start Ollama
echo "🚀 Starting Ollama service..."
docker-compose up -d ollama
echo "✓ Ollama started"
echo ""

# Wait for Ollama
echo "⏳ Waiting for Ollama to be ready..."
sleep 5

for i in {1..30}; do
  if docker-compose exec -T ollama curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
    echo "✓ Ollama is ready"
    break
  fi
  echo -n "."
  sleep 2
done
echo ""

# Download models
echo "📦 Downloading models (this may take 10-20 minutes)..."
echo ""

MODELS=("llama3.2:3b" "llama3.1:8b" "qwen2.5-coder:7b" "nomic-embed-text")

for model in "${MODELS[@]}"; do
  echo "Pulling $model..."
  docker-compose exec -T ollama ollama pull "$model"
  echo "✓ $model downloaded"
  echo ""
done

echo "╔════════════════════════════════════════════════════════╗"
echo "║            Docker Setup Complete! 🎉                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Quick Start:"
echo "  docker-compose run --rm kochava \"format this: function foo(){return 1}\""
echo "  docker-compose --profile server up -d    # Start HTTP server"
echo "  docker-compose --profile plugin up -d    # Start Claude plugin"
echo ""
echo "Check status:"
echo "  docker-compose ps"
echo ""
echo "View logs:"
echo "  docker-compose logs -f"
echo ""
echo "Documentation: README_DOCKER.md"
echo ""
