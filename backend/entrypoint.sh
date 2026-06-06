#!/bin/sh
set -e

CHECKSUM_FILE="/tmp/gomod_checksum"
NEW_CHECKSUM=$(cat go.mod go.sum 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -d "/go/pkg/mod" ]; then
  echo "module cache missing, running go mod download..."
  go mod download
  echo "$NEW_CHECKSUM" > "$CHECKSUM_FILE"
elif [ ! -f "$CHECKSUM_FILE" ] || [ "$(cat "$CHECKSUM_FILE" 2>/dev/null)" != "$NEW_CHECKSUM" ]; then
  echo "go.mod or go.sum changed, running go mod download..."
  go mod download
  echo "$NEW_CHECKSUM" > "$CHECKSUM_FILE"
fi

exec "$@"
