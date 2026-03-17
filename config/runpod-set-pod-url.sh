#!/usr/bin/env bash
# Set OPENAI_REVERSE_PROXY to RunPod Pod URL and redeploy Railway.
# Usage: ./config/runpod-set-pod-url.sh "https://POD_ID-8000.proxy.runpod.net/v1"

set -e
URL="${1:?Usage: $0 \"https://POD_ID-8000.proxy.runpod.net/v1\"}"
cd "$(dirname "$0")/.."
railway variables set "OPENAI_REVERSE_PROXY=$URL" 2>/dev/null || { echo "Railway CLI not linked or not logged in."; exit 1; }
railway redeploy --yes 2>/dev/null || true
echo "OPENAI_REVERSE_PROXY set to $URL and redeploy triggered."
