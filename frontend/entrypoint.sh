#!/bin/sh
set -e

if [ ! -d "node_modules/.bin" ] || [ ! -f "node_modules/.bin/vite" ]; then
  echo "node_modules missing or incomplete, running npm install..."
  npm install --no-fund --no-audit
fi

exec "$@"
