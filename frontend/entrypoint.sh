#!/bin/sh
set -e

CHECKSUM_FILE="/tmp/node_modules_checksum"
NEW_CHECKSUM=$(cat package.json package-lock.json 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -d "node_modules" ]; then
  echo "node_modules missing, running npm install..."
  npm install --no-fund --no-audit
  echo "$NEW_CHECKSUM" > "$CHECKSUM_FILE"
elif [ ! -f "$CHECKSUM_FILE" ] || [ "$(cat "$CHECKSUM_FILE" 2>/dev/null)" != "$NEW_CHECKSUM" ]; then
  echo "package.json or package-lock.json changed, running npm install..."
  npm install --no-fund --no-audit
  echo "$NEW_CHECKSUM" > "$CHECKSUM_FILE"
fi

exec "$@"
