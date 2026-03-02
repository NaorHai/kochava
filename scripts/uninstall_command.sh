#!/bin/bash

set -e

echo "Uninstalling 'kochava' command..."

INSTALL_DIR="/usr/local/bin"
COMMAND_NAME="kochava"

if [ -L "$INSTALL_DIR/$COMMAND_NAME" ]; then
  sudo rm "$INSTALL_DIR/$COMMAND_NAME"
  echo "✓ kochava command removed from $INSTALL_DIR"
else
  echo "⚠️  kochava command not found in $INSTALL_DIR"
fi

echo ""
echo "Uninstallation complete."
