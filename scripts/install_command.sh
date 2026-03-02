#!/bin/bash

set -e

PURPLE='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}║         Installing 'kochava' Global Command              ║${NC}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Check if project is built
if [ ! -d "$PROJECT_ROOT/dist" ]; then
  echo -e "${YELLOW}⚠️  Project not built. Building now...${NC}"
  cd "$PROJECT_ROOT"
  npm run build
  echo ""
fi

# Use ~/.local/bin instead of /usr/local/bin (no sudo needed)
INSTALL_DIR="$HOME/.local/bin"
COMMAND_NAME="kochava"

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

echo -e "${GREEN}Installing kochava to: $INSTALL_DIR/$COMMAND_NAME${NC}"
echo ""

# Remove old installation if exists
if [ -f "$INSTALL_DIR/$COMMAND_NAME" ]; then
  echo "Removing old installation..."
  rm "$INSTALL_DIR/$COMMAND_NAME"
fi

# Create wrapper script
cat > "$INSTALL_DIR/$COMMAND_NAME" << EOF
#!/bin/bash
node "$PROJECT_ROOT/dist/interfaces/kochava.js" "\$@"
EOF

chmod +x "$INSTALL_DIR/$COMMAND_NAME"

echo -e "${GREEN}✓ Command installed${NC}"
echo ""

# Detect shell and add to PATH if needed
SHELL_CONFIG=""
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ]; then
  SHELL_CONFIG="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ]; then
  SHELL_CONFIG="$HOME/.bashrc"
fi

# Check if PATH already includes ~/.local/bin
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  if [ -n "$SHELL_CONFIG" ]; then
    echo -e "${YELLOW}Adding ~/.local/bin to PATH in $SHELL_CONFIG${NC}"
    echo "" >> "$SHELL_CONFIG"
    echo "# Kochava global command" >> "$SHELL_CONFIG"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
    echo -e "${GREEN}✓ PATH updated${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Please restart your terminal or run:${NC}"
    echo -e "   ${GREEN}source $SHELL_CONFIG${NC}"
    echo ""
  fi
else
  echo -e "${GREEN}✓ ~/.local/bin already in PATH${NC}"
  echo ""
fi

# Verify installation
if [ -f "$INSTALL_DIR/$COMMAND_NAME" ]; then
  echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PURPLE}║                Installation Successful! 🎉                ║${NC}"
  echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "Try these commands (after restarting terminal):"
  echo -e "  ${GREEN}kochava \"format this: function foo(){return 1}\"${NC}"
  echo -e "  ${GREEN}kochava --chat${NC}"
  echo -e "  ${GREEN}kochava --stats${NC}"
  echo ""
  echo "Or test now with full path:"
  echo -e "  ${GREEN}$INSTALL_DIR/kochava --help${NC}"
  echo ""
else
  echo -e "${YELLOW}⚠️  Installation may have failed.${NC}"
  echo ""
fi
