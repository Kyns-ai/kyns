#!/bin/sh
chown -R node:node /app/client/public/images /app/logs /app/uploads 2>/dev/null || true
exec su-exec node "$@"
