#!/bin/bash

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║         AI Router - Bootstrap Installation             ║"
echo "║                                                        ║"
echo "║     🎉 100% FREE Local AI Models Included! 🎉         ║"
echo "║                                                        ║"
echo "║  • No subscriptions required                           ║"
echo "║  • Runs 60-80% of tasks locally (FREE)                 ║"
echo "║  • Optional Claude API for complex tasks               ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v ollama &> /dev/null; then
  echo "📥 Ollama not found. Installing Ollama..."
  echo ""

  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected macOS. Downloading Ollama installer..."
    curl -L https://ollama.ai/download/Ollama-darwin.zip -o /tmp/Ollama.zip
    unzip -q /tmp/Ollama.zip -d /tmp/
    sudo mv /tmp/Ollama.app /Applications/
    sudo xattr -dr com.apple.quarantine /Applications/Ollama.app
    open /Applications/Ollama.app
    echo "✓ Ollama installed. Waiting for Ollama to start..."
    sleep 5
  else
    echo "Please install Ollama manually from: https://ollama.ai"
    exit 1
  fi
else
  echo "✓ Ollama already installed"
  echo ""
fi

if ! pgrep -x "ollama" > /dev/null; then
  echo "⚠️  Ollama is not running. Starting Ollama..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open /Applications/Ollama.app
    sleep 3
  else
    ollama serve &
    sleep 3
  fi
fi

echo "✓ Ollama is running"
echo ""

echo "Step 1: Setting up environment"
bash "$PROJECT_ROOT/scripts/setup_env.sh"
echo ""

if [ ! -f "$PROJECT_ROOT/.env" ] || ! grep -q "ANTHROPIC_API_KEY=sk-" "$PROJECT_ROOT/.env"; then
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║           OPTIONAL: Claude API Configuration           ║"
  echo "╚════════════════════════════════════════════════════════╝"
  echo ""
  echo "The system works with FREE local models only!"
  echo ""
  echo "Adding Claude API (optional) enables:"
  echo "  ✓ Complex debugging and architecture design"
  echo "  ✓ Multi-file reasoning and refactoring"
  echo "  ✓ Deep code analysis"
  echo ""
  echo "Without Claude API:"
  echo "  ✓ Still handles 60-80% of requests (FREE)"
  echo "  ✓ Code formatting, explanations, simple edits"
  echo "  ✓ Complete privacy (never leaves your machine)"
  echo ""
  read -p "Enter your Anthropic API key (or press Enter to skip): " api_key
  if [ -n "$api_key" ]; then
    sed -i.bak "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$api_key/" "$PROJECT_ROOT/.env"
    rm "$PROJECT_ROOT/.env.bak" 2>/dev/null || true
    echo "✓ API key saved - Complex tasks will use Claude"
  else
    sed -i.bak "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=none/" "$PROJECT_ROOT/.env"
    rm "$PROJECT_ROOT/.env.bak" 2>/dev/null || true
    echo "✓ Skipped - Running with FREE local models only"
  fi
  echo ""
fi

echo "Step 2: Installing Ollama models"
bash "$PROJECT_ROOT/scripts/install_models.sh"
echo ""

echo "Step 3: Running verification test"
bash "$PROJECT_ROOT/scripts/verify.sh"
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║              Installation Complete! 🎉                 ║"
echo "║                                                        ║"
echo "║  ✅ FREE Local Models Installed (4 models, ~12GB)     ║"
echo "║  ✅ System Ready - 60-80% tasks run locally (FREE)    ║"
echo "║  ✅ No API costs for most operations                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Install Global 'kochava' Command (Recommended):"
echo "  npm run install-command"
echo ""
echo "Then use from anywhere:"
echo "  kochava \"format this: function foo(){return 1}\""
echo "  kochava --chat"
echo "  kochava --stats"
echo ""
echo "Or use local runners:"
echo "  ./run.sh              - Start interactive CLI"
echo "  npm run server        - Start HTTP server (port 3000)"
echo "  npm run plugin        - Start Claude plugin (port 3001)"
echo ""
echo "Documentation:"
echo "  KOCHAVA_GUIDE.md      - Kochava command guide"
echo "  README.md             - Full documentation"
echo "  LOCAL_MODELS.md       - FREE models explained"
echo "  QUICKSTART.md         - 5-minute guide"
echo ""
