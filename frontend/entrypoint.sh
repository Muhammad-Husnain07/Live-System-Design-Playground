#!/bin/sh
set -e

CHECK_FILE="node_modules/.deps_ok"
STORED_HASH=""
CURRENT_HASH=$(cat package.json package-lock.json 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)

if [ -f "$CHECK_FILE" ]; then
  STORED_HASH=$(cat "$CHECK_FILE")
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules missing, running npm install..."
  npm install --no-fund --no-audit
  echo "$CURRENT_HASH" > "$CHECK_FILE"
elif [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  echo "package.json or package-lock.json changed, running npm install..."
  npm install --no-fund --no-audit
  echo "$CURRENT_HASH" > "$CHECK_FILE"
fi

exec "$@"
