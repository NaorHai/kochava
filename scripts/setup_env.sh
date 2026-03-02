#!/bin/bash

set -e

PROJECT_ROOT="$(dirname "$0")/.."

echo "🔧 Setting up environment..."
echo ""

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "📝 Creating .env file from template..."
  cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
  echo "✓ .env file created"
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and add your ANTHROPIC_API_KEY"
  echo "   File location: $PROJECT_ROOT/.env"
  echo ""
else
  echo "✓ .env file already exists"
  echo ""
fi

if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js not found. Please install Node.js 18 or higher."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Error: Node.js version must be 18 or higher. Current: $(node -v)"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

echo "📦 Installing npm dependencies..."
cd "$PROJECT_ROOT"
npm install
echo "✓ Dependencies installed"
echo ""

echo "🏗️  Building TypeScript..."
npm run build
echo "✓ Build complete"
echo ""

echo "📁 Creating log directories..."
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/embeddings"
touch "$PROJECT_ROOT/models/.gitkeep"
touch "$PROJECT_ROOT/embeddings/.gitkeep"
touch "$PROJECT_ROOT/logs/.gitkeep"
echo "✓ Directories created"
echo ""

echo "✅ Environment setup complete!"
