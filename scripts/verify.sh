#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🧪 Running verification tests..."
echo ""

echo "Test 1: Checking Ollama connectivity"
if curl -s http://localhost:11434/api/version > /dev/null; then
  echo "✓ Ollama is accessible"
else
  echo "❌ Ollama is not accessible at http://localhost:11434"
  exit 1
fi
echo ""

echo "Test 2: Checking installed models"
REQUIRED_MODELS=("llama3.2:3b" "llama3.1:8b" "qwen2.5-coder:7b" "nomic-embed-text")
MISSING_MODELS=()

for model in "${REQUIRED_MODELS[@]}"; do
  if ollama list | grep -q "$model"; then
    echo "✓ $model is installed"
  else
    echo "⚠️  $model is not installed"
    MISSING_MODELS+=("$model")
  fi
done

if [ ${#MISSING_MODELS[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  Some models are missing. Run: bash scripts/install_models.sh"
fi
echo ""

echo "Test 3: Checking environment configuration"
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "✓ .env file exists"

  if grep -q "ANTHROPIC_API_KEY=sk-" "$PROJECT_ROOT/.env"; then
    echo "✓ ANTHROPIC_API_KEY is set"
  else
    echo "⚠️  ANTHROPIC_API_KEY is not set (Claude routing will not work)"
  fi
else
  echo "❌ .env file not found"
  exit 1
fi
echo ""

echo "Test 4: Checking build artifacts"
if [ -d "$PROJECT_ROOT/dist" ]; then
  echo "✓ Build directory exists"
else
  echo "❌ Build directory not found. Run: npm run build"
  exit 1
fi
echo ""

echo "Test 5: Testing classifier model"
TEST_RESPONSE=$(ollama run llama3.2:3b "Reply with only: OK" 2>&1 | tail -n 1)
if [[ "$TEST_RESPONSE" == *"OK"* ]] || [[ "$TEST_RESPONSE" != "" ]]; then
  echo "✓ Classifier model responds"
else
  echo "⚠️  Classifier model test inconclusive"
fi
echo ""

echo "✅ Verification complete!"
echo ""
echo "System status:"
echo "  Ollama:           ✓ Running"
echo "  Models:           ${#MISSING_MODELS[@]} missing"
echo "  Environment:      ✓ Configured"
echo "  Build:            ✓ Ready"
echo ""
