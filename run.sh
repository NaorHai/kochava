#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d "dist" ]; then
  echo "Build artifacts not found. Building..."
  npm run build
fi

if [ ! -f ".env" ]; then
  echo "❌ Error: .env file not found"
  echo "Run: ./scripts/bootstrap.sh"
  exit 1
fi

node dist/interfaces/cli.js "$@"
