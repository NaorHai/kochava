#!/bin/bash

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         Installing 'kochava' Global Command              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Check if project is built
if [ ! -d "$PROJECT_ROOT/dist" ]; then
  echo "⚠️  Project not built. Building now..."
  cd "$PROJECT_ROOT"
  npm run build
  echo ""
fi

# Create symlink location
INSTALL_DIR="/usr/local/bin"
COMMAND_NAME="kochava"

echo "Installing kochava to: $INSTALL_DIR/$COMMAND_NAME"
echo ""

# Remove old symlink if exists
if [ -L "$INSTALL_DIR/$COMMAND_NAME" ]; then
  echo "Removing old installation..."
  sudo rm "$INSTALL_DIR/$COMMAND_NAME"
fi

# Create new symlink
echo "Creating symlink..."
sudo ln -s "$PROJECT_ROOT/dist/interfaces/kochava.js" "$INSTALL_DIR/$COMMAND_NAME"
sudo chmod +x "$PROJECT_ROOT/dist/interfaces/kochava.js"

echo "✓ Symlink created"
echo ""

# Verify installation
if command -v kochava &> /dev/null; then
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║                Installation Successful! 🎉                ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo ""
  echo "Try these commands:"
  echo "  kochava \"format this: function foo(){return 1}\""
  echo "  kochava --chat"
  echo "  kochava --stats"
  echo ""
  echo "Run 'kochava --help' for all options"
  echo ""
else
  echo "⚠️  Installation may have failed. Try manually adding to PATH:"
  echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
  echo ""
fi
