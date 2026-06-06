#!/bin/sh
set -e

CHECK_FILE=".go_deps_ok"
STORED_HASH=""
CURRENT_HASH=$(cat go.mod go.sum 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)

if [ -f "$CHECK_FILE" ]; then
  STORED_HASH=$(cat "$CHECK_FILE")
fi

if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  echo "go.mod or go.sum changed, running go mod download..."
  go mod download
  echo "$CURRENT_HASH" > "$CHECK_FILE"
fi

exec "$@"
