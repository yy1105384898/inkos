#!/bin/sh
set -eu

DATA_DIR="${INKOS_DATA_ROOT:-${INKOS_PROJECT_ROOT:-/data}}"

mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"
exec su-exec node "$@"
