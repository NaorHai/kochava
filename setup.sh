#!/bin/bash

set -e

# Colors
PURPLE='\033[0;35m'
PINK='\033[1;35m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

clear

echo -e "${PINK}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██╗  ██╗ ██████╗  ██████╗██╗  ██╗ █████╗ ██╗   ██╗ █████╗     ║
║   ██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██╔══██╗██║   ██║██╔══██╗    ║
║   █████╔╝ ██║   ██║██║     ███████║███████║██║   ██║███████║    ║
║   ██╔═██╗ ██║   ██║██║     ██╔══██║██╔══██║╚██╗ ██╔╝██╔══██║    ║
║   ██║  ██╗╚██████╔╝╚██████╗██║  ██║██║  ██║ ╚████╔╝ ██║  ██║    ║
║   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝    ║
║                                                                   ║
║            Intelligent AI Router • Local + Cloud                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${PURPLE}🎉 FREE Local AI Models • 60-80% Tasks Run Locally${NC}\n"

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Check Node.js version
REQUIRED_NODE_VERSION=18
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
    echo -e "${YELLOW}⚠️  Node.js version $REQUIRED_NODE_VERSION or higher is required${NC}"
    echo -e "   Current version: $(node -v)"
    echo -e "   Please upgrade Node.js: https://nodejs.org"
    exit 1
  fi
  echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"
else
  echo -e "${YELLOW}⚠️  Node.js not found${NC}"
  echo -e "   Please install Node.js $REQUIRED_NODE_VERSION or higher"
  echo -e "   Download from: https://nodejs.org"
  exit 1
fi
echo ""

# Ask user for installation type
echo -e "${CYAN}Choose installation method:${NC}"
echo -e "  ${GREEN}1${NC}) 🐳 Docker (Recommended - Zero dependencies)"
echo -e "  ${GREEN}2${NC}) 💻 Local (Native installation)"
echo ""
read -p "$(echo -e ${CYAN}"Enter choice [1-2]: "${NC})" choice

case $choice in
  1|docker|Docker|DOCKER)
    INSTALL_TYPE="docker"
    ;;
  2|local|Local|LOCAL)
    INSTALL_TYPE="local"
    ;;
  *)
    echo -e "${YELLOW}Invalid choice. Defaulting to Docker installation.${NC}"
    INSTALL_TYPE="docker"
    ;;
esac

echo ""

if [ "$INSTALL_TYPE" = "docker" ]; then
  echo -e "${PINK}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PINK}║       Docker Installation - Everything in Containers       ║${NC}"
  echo -e "${PINK}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}❌ Docker not found. Please install Docker Desktop:${NC}"
    echo -e "   https://www.docker.com/products/docker-desktop"
    exit 1
  fi

  if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}❌ docker-compose not found. Please install Docker Compose.${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Docker is installed${NC}"
  echo ""

  # Create .env if doesn't exist
  if [ ! -f .env ]; then
    echo -e "${CYAN}📝 Creating .env file...${NC}"
    cp .env.example .env

    # Try to extract Claude API key and Bedrock settings from Claude Code settings
    if command -v jq &> /dev/null && [ -f "$HOME/.claude/settings.json" ]; then
      API_KEY=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN // empty' "$HOME/.claude/settings.json" 2>/dev/null)
      BEDROCK_URL=$(jq -r '.env.ANTHROPIC_BEDROCK_BASE_URL // empty' "$HOME/.claude/settings.json" 2>/dev/null)
      SKIP_BEDROCK_AUTH=$(jq -r '.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH // empty' "$HOME/.claude/settings.json" 2>/dev/null)

      if [ -n "$API_KEY" ] && [ "$API_KEY" != "null" ]; then
        echo -e "${GREEN}✓ Found Claude API key in settings${NC}"
        sed -i.bak "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" .env
        rm .env.bak 2>/dev/null || true
      fi

      if [ -n "$BEDROCK_URL" ] && [ "$BEDROCK_URL" != "null" ]; then
        echo -e "${GREEN}✓ Found Bedrock base URL in settings${NC}"
        sed -i.bak "s|ANTHROPIC_BEDROCK_BASE_URL=.*|ANTHROPIC_BEDROCK_BASE_URL=$BEDROCK_URL|" .env
        rm .env.bak 2>/dev/null || true

        if [ -n "$SKIP_BEDROCK_AUTH" ] && [ "$SKIP_BEDROCK_AUTH" != "null" ]; then
          echo -e "${GREEN}✓ Bedrock auth mode configured${NC}"
          sed -i.bak "s|CLAUDE_CODE_SKIP_BEDROCK_AUTH=.*|CLAUDE_CODE_SKIP_BEDROCK_AUTH=$SKIP_BEDROCK_AUTH|" .env
          rm .env.bak 2>/dev/null || true
        fi
      fi
    fi

    echo -e "${GREEN}✓ .env created${NC}"
    echo ""
  fi

  # Build containers
  echo -e "${CYAN}🏗️  Building Docker containers...${NC}"
  docker-compose build
  echo -e "${GREEN}✓ Containers built${NC}"
  echo ""

  # Start Ollama
  echo -e "${CYAN}🚀 Starting Ollama service...${NC}"
  docker-compose up -d ollama
  echo -e "${GREEN}✓ Ollama started${NC}"
  echo ""

  # Wait for Ollama
  echo -e "${CYAN}⏳ Waiting for Ollama to be ready...${NC}"
  sleep 5

  for i in {1..30}; do
    if docker-compose exec -T ollama curl -s http://localhost:11434/api/version > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Ollama is ready${NC}"
      break
    fi
    echo -n "."
    sleep 2
  done
  echo ""

  # Download models
  echo -e "${CYAN}📦 Downloading FREE models (this may take 10-20 minutes)...${NC}"
  echo ""

  MODELS=("llama3.2:3b" "llama3.1:8b" "qwen2.5-coder:7b" "nomic-embed-text")

  for model in "${MODELS[@]}"; do
    echo -e "${PURPLE}Pulling $model...${NC}"
    docker-compose exec -T ollama ollama pull "$model"
    echo -e "${GREEN}✓ $model downloaded${NC}"
    echo ""
  done

  echo -e "${PINK}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PINK}║            Docker Setup Complete! 🎉                       ║${NC}"
  echo -e "${PINK}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${CYAN}Quick Start:${NC}"
  echo -e "  ${GREEN}docker-compose run --rm kochava \"format this: function foo(){return 1}\"${NC}"
  echo -e "  ${GREEN}docker-compose --profile server up -d${NC}    # Start HTTP server"
  echo -e "  ${GREEN}docker-compose --profile plugin up -d${NC}    # Start Claude plugin"
  echo ""
  echo -e "${CYAN}Documentation:${NC} README.md"

else
  echo -e "${PINK}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PINK}║           Local Installation - Native Setup                ║${NC}"
  echo -e "${PINK}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Install Ollama
  if ! command -v ollama &> /dev/null; then
    echo -e "${CYAN}📥 Installing Ollama...${NC}"
    echo ""

    if [[ "$OSTYPE" == "darwin"* ]]; then
      if command -v brew &> /dev/null; then
        brew install ollama
        echo -e "${GREEN}✓ Ollama installed via Homebrew${NC}"
      else
        echo -e "${YELLOW}Homebrew not found. Installing via curl...${NC}"
        curl -fsSL https://ollama.com/install.sh | sh
        echo -e "${GREEN}✓ Ollama installed${NC}"
      fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      curl -fsSL https://ollama.com/install.sh | sh
      echo -e "${GREEN}✓ Ollama installed${NC}"
    else
      echo -e "${YELLOW}Please install Ollama manually from: https://ollama.ai${NC}"
      exit 1
    fi
    echo ""
  else
    echo -e "${GREEN}✓ Ollama already installed${NC}"
    echo ""
  fi

  # Start Ollama
  if ! pgrep -x "ollama" > /dev/null; then
    echo -e "${CYAN}🚀 Starting Ollama...${NC}"
    ollama serve > /dev/null 2>&1 &
    sleep 3
    echo -e "${GREEN}✓ Ollama started${NC}"
  else
    echo -e "${GREEN}✓ Ollama is running${NC}"
  fi
  echo ""

  # Setup environment
  echo -e "${CYAN}📝 Setting up environment...${NC}"

  # Create .env if doesn't exist
  if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ .env created${NC}"

    # Try to extract Claude API key and Bedrock settings from Claude Code settings
    if command -v jq &> /dev/null && [ -f "$HOME/.claude/settings.json" ]; then
      API_KEY=$(jq -r '.env.ANTHROPIC_AUTH_TOKEN // empty' "$HOME/.claude/settings.json" 2>/dev/null)
      BEDROCK_URL=$(jq -r '.env.ANTHROPIC_BEDROCK_BASE_URL // empty' "$HOME/.claude/settings.json" 2>/dev/null)
      SKIP_BEDROCK_AUTH=$(jq -r '.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH // empty' "$HOME/.claude/settings.json" 2>/dev/null)

      if [ -n "$API_KEY" ] && [ "$API_KEY" != "null" ]; then
        echo -e "${GREEN}✓ Found Claude API key in settings${NC}"
        sed -i.bak "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" .env
        rm .env.bak 2>/dev/null || true
        echo -e "${GREEN}✓ API key configured automatically${NC}"
      fi

      if [ -n "$BEDROCK_URL" ] && [ "$BEDROCK_URL" != "null" ]; then
        echo -e "${GREEN}✓ Found Bedrock base URL in settings${NC}"
        sed -i.bak "s|ANTHROPIC_BEDROCK_BASE_URL=.*|ANTHROPIC_BEDROCK_BASE_URL=$BEDROCK_URL|" .env
        rm .env.bak 2>/dev/null || true
        echo -e "${GREEN}✓ Bedrock endpoint configured${NC}"

        if [ -n "$SKIP_BEDROCK_AUTH" ] && [ "$SKIP_BEDROCK_AUTH" != "null" ]; then
          sed -i.bak "s|CLAUDE_CODE_SKIP_BEDROCK_AUTH=.*|CLAUDE_CODE_SKIP_BEDROCK_AUTH=$SKIP_BEDROCK_AUTH|" .env
          rm .env.bak 2>/dev/null || true
        fi
      fi
    fi
  else
    echo -e "${GREEN}✓ .env exists${NC}"
  fi

  # Install dependencies
  if [ ! -d "node_modules" ]; then
    echo -e "${CYAN}📦 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
  else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
  fi

  # Build project
  if [ ! -d "dist" ]; then
    echo -e "${CYAN}🏗️  Building project...${NC}"
    npm run build
    echo -e "${GREEN}✓ Project built${NC}"
  else
    echo -e "${GREEN}✓ Project already built${NC}"
  fi

  echo ""

  # Download models
  echo -e "${CYAN}📦 Downloading FREE models (this may take 10-20 minutes)...${NC}"
  echo ""

  MODELS=("llama3.2:3b" "llama3.1:8b" "qwen2.5-coder:7b" "nomic-embed-text")

  for model in "${MODELS[@]}"; do
    # Check if model already exists
    if ollama list | grep -q "$model"; then
      echo -e "${GREEN}✓ $model already downloaded${NC}"
    else
      echo -e "${PURPLE}Pulling $model...${NC}"
      ollama pull "$model"
      echo -e "${GREEN}✓ $model downloaded${NC}"
    fi
    echo ""
  done

  # Verify models
  echo -e "${CYAN}📋 Installed models:${NC}"
  ollama list
  echo ""

  echo -e "${PINK}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PINK}║            Local Setup Complete! 🎉                        ║${NC}"
  echo -e "${PINK}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Install global command automatically
  echo -e "${CYAN}Installing global kochava command...${NC}"
  ./scripts/install_command.sh
  echo ""

  echo -e "${CYAN}Quick Start (after restarting terminal):${NC}"
  echo -e "  ${GREEN}kochava \"format this: function foo(){return 1}\"${NC}"
  echo -e "  ${GREEN}kochava --chat${NC}         # Interactive mode"
  echo -e "  ${GREEN}kochava --stats${NC}        # Show statistics"
  echo ""

  echo -e "${CYAN}Or use npm (works now):${NC}"
  echo -e "  ${GREEN}npm run kochava -- \"your question\"${NC}"
  echo ""

  echo -e "${CYAN}Documentation:${NC} README.md"
fi

echo ""
