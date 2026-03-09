#!/usr/bin/env bash
# Deploy SearXNG as a Railway service and wire it to LibreChat.
# The custom image (ghcr.io/kyns-ai/kyns-searxng:latest) has settings.yml
# baked in with JSON format and rate-limiting disabled.
# Usage: ./config/railway-add-searxng.sh
# Requires: Railway CLI logged in and project linked.

set -euo pipefail
cd "$(dirname "$0")/.."

SEARXNG_SECRET_KEY=$(openssl rand -hex 32)
echo "🔑 Generated secret key: ${SEARXNG_SECRET_KEY:0:8}..."

echo ""
echo "📦 Creating SearXNG service on Railway (Docker image)..."

railway add \
  --service searxng \
  --image ghcr.io/kyns-ai/kyns-searxng:latest \
  --variables "SEARXNG_SECRET_KEY=${SEARXNG_SECRET_KEY}" \
  --variables "PORT=8080"

echo ""
echo "🌐 Getting SearXNG URL..."
sleep 10
SEARXNG_PUBLIC=$(railway domain --service searxng 2>/dev/null | grep "railway.app" | head -1 || echo "")

# Prefer private Railway internal URL (no latency, no public egress)
SEARXNG_URL="http://searxng.railway.internal:8080"
echo "✅ Using internal URL: ${SEARXNG_URL}"
echo "   Public URL (for verification): https://${SEARXNG_PUBLIC}"

echo ""
echo "🔗 Setting SEARXNG_INSTANCE_URL on LibreChat..."
railway variables set \
  --service LibreChat \
  "SEARXNG_INSTANCE_URL=${SEARXNG_URL}"

echo ""
echo "🔄 Redeploying LibreChat..."
railway service redeploy --service LibreChat --yes 2>/dev/null || true

echo ""
echo "✅ Done!"
echo ""
echo "Test JSON: curl \"https://${SEARXNG_PUBLIC}/search?q=test&format=json\" | head"
echo "LibreChat toggle: any chat → 🔍 web search badge"
