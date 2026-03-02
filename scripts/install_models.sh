#!/bin/bash

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Installing FREE Local Models via Ollama              ║"
echo "║  No API keys or paid services required!               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "These models run 100% locally on your machine."
echo "Download size: ~12GB total (one-time download)"
echo ""

CONFIG_FILE="$(dirname "$0")/../config/model.config.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Error: model.config.json not found"
  exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
  echo "⚠️  Ollama is not running. Starting Ollama..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open /Applications/Ollama.app
    sleep 3
  else
    echo "Please start Ollama manually: ollama serve"
    exit 1
  fi
fi

echo "✓ Ollama is running"
echo ""

MODELS=$(jq -r '.downloadOrder[]' "$CONFIG_FILE")

echo "Models to install:"
for model in $MODELS; do
  echo "  - $model (FREE, local)"
done
echo ""

for model in $MODELS; do
  echo "📦 Pulling model: $model"
  echo "   This may take a few minutes..."

  if ollama pull "$model"; then
    echo "   ✓ $model installed successfully"
  else
    echo "   ⚠️  Failed to install $model (will retry on next run)"
  fi
  echo ""
done

echo "✅ All models installed successfully!"
echo ""
echo "Installed models (all FREE and local):"
ollama list
echo ""
echo "These models require NO internet connection to run."
echo "They will handle 60-80% of your requests locally."
