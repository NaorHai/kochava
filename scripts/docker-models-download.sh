#!/bin/bash

set -e

echo "📦 Downloading Ollama models in Docker..."
echo ""

# Check if Ollama container is running
if ! docker-compose ps ollama | grep -q "Up"; then
  echo "Starting Ollama..."
  docker-compose up -d ollama
  sleep 5
fi

# Download each model
MODELS=("llama3.2:3b" "llama3.1:8b" "qwen2.5-coder:7b" "nomic-embed-text")

for model in "${MODELS[@]}"; do
  echo "Pulling $model..."
  docker-compose exec -T ollama ollama pull "$model" || {
    echo "⚠️  Failed to pull $model. Retrying..."
    docker-compose exec -T ollama ollama pull "$model"
  }
  echo "✓ $model downloaded"
  echo ""
done

echo "✅ All models downloaded!"
echo ""
echo "Verify installation:"
echo "  docker-compose exec ollama ollama list"
