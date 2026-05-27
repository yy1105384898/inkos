#!/bin/sh
set -eu

DATA_DIR="${INKOS_PROJECT_ROOT:-/data}"
APP_NAME="${INKOS_PROJECT_NAME:-YANGYANG 小说 Agent}"

mkdir -p "$DATA_DIR/books" "$DATA_DIR/radar" "$DATA_DIR/.inkos"

if [ ! -f "$DATA_DIR/inkos.json" ]; then
  cat > "$DATA_DIR/inkos.json" <<EOF
{
  "name": "$APP_NAME",
  "version": "0.1.0",
  "language": "zh",
  "llm": {
    "provider": "openai",
    "service": "custom",
    "configSource": "studio",
    "baseUrl": "",
    "model": "",
    "apiFormat": "chat",
    "stream": true
  },
  "notify": [],
  "inputGovernanceMode": "v2",
  "daemon": {
    "schedule": {
      "radarCron": "0 */6 * * *",
      "writeCron": "*/15 * * * *"
    },
    "maxConcurrentBooks": 3
  }
}
EOF
fi

chown -R node:node "$DATA_DIR"
exec su-exec node "$@"
