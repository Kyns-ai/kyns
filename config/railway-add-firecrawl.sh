#!/usr/bin/env bash
# Deploy Firecrawl self-hosted on Railway and wire to LibreChat.
#
# Prerequisites:
#   - Railway project already has a Redis service (managed database named "Redis")
#   - Railway CLI logged in and project linked
#   - Your firecrawl-worker image published to a container registry
#     (triggered automatically when firecrawl-worker/Dockerfile changes)
#
# Architecture (3 new Railway services + existing Redis):
#   Redis               -- already exists in the project (managed database)
#   firecrawl-puppeteer -- headless browser for JS-heavy pages (stealth)
#   firecrawl           -- Firecrawl v1 API (HTTP, queues jobs to Redis)
#   firecrawl-worker2   -- BullMQ job processor (runs queue-worker.ts)
#
# Images:
#   trieve/firecrawl:v0.0.55              (API, ~901 MB)
#   trieve/puppeteer-service-ts:v0.0.13   (headless browser, ~1.1 GB)
#   YOUR_REGISTRY/firecrawl-worker:latest (worker, inherits trieve/firecrawl:v0.0.55)
#
# Usage: ./config/railway-add-firecrawl.sh
# IMPORTANT: The worker image must be built first via GitHub Actions
# (push to main with changes in firecrawl-worker/ triggers the build).

set -euo pipefail
cd "$(dirname "$0")/.."

FIRECRAWL_WORKER_IMAGE="${FIRECRAWL_WORKER_IMAGE:-ghcr.io/YOUR_ORG/firecrawl-worker:latest}"

# ---------------------------------------------------------------------------
# Read Redis URL from the existing managed Redis service
# ---------------------------------------------------------------------------
echo "Reading Redis URL from existing service..."

REDIS_URL=$(railway variable list --service "Redis" --json 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('REDIS_URL',''))" 2>/dev/null \
  || echo "")

if [ -z "$REDIS_URL" ]; then
  echo "ERROR: Could not read REDIS_URL from the 'Redis' service."
  echo "  Make sure Railway CLI is logged in and the project is linked."
  exit 1
fi

echo "Redis URL found (internal): ${REDIS_URL%%@*}@..."

# ---------------------------------------------------------------------------
# Generate Firecrawl API key
# ---------------------------------------------------------------------------
FIRECRAWL_API_KEY=$(openssl rand -hex 24)
echo "Firecrawl API key (first 8 chars): ${FIRECRAWL_API_KEY:0:8}..."

PUPPETEER_INTERNAL_URL="http://firecrawl-puppeteer.railway.internal:3000"
FIRECRAWL_INTERNAL_URL="http://firecrawl.railway.internal:3002"

# ---------------------------------------------------------------------------
# 1. Puppeteer microservice
# ---------------------------------------------------------------------------
echo ""
echo "Step 1/4 — Deploying firecrawl-puppeteer..."

railway add \
  --service "firecrawl-puppeteer" \
  --image "trieve/puppeteer-service-ts:v0.0.13" \
  --variables "PORT=3000" \
  --variables "HOST=0.0.0.0"

echo "Puppeteer service created: ${PUPPETEER_INTERNAL_URL}"

# ---------------------------------------------------------------------------
# 2. Firecrawl API service
# ---------------------------------------------------------------------------
echo ""
echo "Step 2/4 — Deploying firecrawl API..."

railway add \
  --service "firecrawl" \
  --image "trieve/firecrawl:v0.0.55" \
  --variables "PORT=3002" \
  --variables "HOST=0.0.0.0" \
  --variables "REDIS_URL=${REDIS_URL}" \
  --variables "REDIS_RATE_LIMIT_URL=${REDIS_URL}" \
  --variables "PLAYWRIGHT_MICROSERVICE_URL=${PUPPETEER_INTERNAL_URL}" \
  --variables "USE_DB_AUTHENTICATION=false" \
  --variables "FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}"

echo "Firecrawl API service created: ${FIRECRAWL_INTERNAL_URL}"

# ---------------------------------------------------------------------------
# 3. Firecrawl BullMQ worker (custom image with overridden CMD)
# ---------------------------------------------------------------------------
echo ""
echo "Step 3/4 — Deploying firecrawl BullMQ worker..."
echo "  (using ${FIRECRAWL_WORKER_IMAGE} — must be built first)"

railway add \
  --service "firecrawl-worker2" \
  --image "${FIRECRAWL_WORKER_IMAGE}" \
  --variables "REDIS_URL=${REDIS_URL}" \
  --variables "REDIS_RATE_LIMIT_URL=${REDIS_URL}" \
  --variables "PLAYWRIGHT_MICROSERVICE_URL=${PUPPETEER_INTERNAL_URL}" \
  --variables "USE_DB_AUTHENTICATION=false" \
  --variables "FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}"

echo "Firecrawl worker service created"

# ---------------------------------------------------------------------------
# 4. Wire into LibreChat env vars
# ---------------------------------------------------------------------------
echo ""
echo "Step 4/4 — Setting Firecrawl vars on LibreChat service..."

railway variable set \
  --service LibreChat \
  "FIRECRAWL_API_URL=${FIRECRAWL_INTERNAL_URL}" \
  "FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}"

echo ""
echo "Redeploying LibreChat..."
railway redeploy --service LibreChat --yes 2>/dev/null || true

echo ""
echo "========================================================"
echo " Firecrawl self-hosted deploy complete!"
echo "========================================================"
echo ""
echo " Railway services:"
echo "   firecrawl-puppeteer : ${PUPPETEER_INTERNAL_URL}"
echo "   firecrawl           : ${FIRECRAWL_INTERNAL_URL}"
echo "   firecrawl-worker2   : (same Redis, processes jobs)"
echo ""
echo " LibreChat env vars:"
echo "   FIRECRAWL_API_URL   = ${FIRECRAWL_INTERNAL_URL}"
echo "   FIRECRAWL_API_KEY   = ${FIRECRAWL_API_KEY}"
echo ""
echo " librechat.yaml scraperProvider=firecrawl already configured."
echo " Push the repo to trigger Railway redeploy."
echo "========================================================"
