# Railway Service Map

This repository is a monorepo. Each Railway service must deploy from the correct directory, or Railway can build the wrong app and silently break production rollouts.

## Expected Service Targets

- `LibreChat`
  Deploy from the repository root with `railway.json` and the root `Dockerfile`.
  Recommended command: `railway up -s LibreChat`

- `kyns-analytics`
  Deploy from `analytics/` with `analytics/railway.json` and `analytics/Dockerfile`.
  Recommended command: `cd analytics && railway up -s kyns-analytics`

- `firecrawl-worker`
  Deploy from `firecrawl-worker/` with `firecrawl-worker/railway.json` and `firecrawl-worker/Dockerfile`.
  Recommended command: `cd firecrawl-worker && railway up -s firecrawl-worker`

- `kyns-tts`
  Deploy from `kyns-tts/` with `kyns-tts/railway.json` and `kyns-tts/Dockerfile`.
  Recommended command: `cd kyns-tts && railway up . --path-as-root -s kyns-tts`

- `searxng`
  Deploy from `searxng/` with `searxng/railway.json` and `searxng/Dockerfile` when rebuilding from this repo.
  Recommended command: `cd searxng && railway up -s searxng`

- `firecrawl-puppeteer`
  Keep as its dedicated service/image unless there is an intentional migration plan.

## Known Failure Modes

- Invalid multi-region config containing `us-east`
  Railway rejects the deployment before build/runtime.

- Wrong root directory in a monorepo
  `kyns-analytics` falls back to `RAILPACK` at the repo root instead of `analytics/`.

- Wrong Dockerfile target
  `firecrawl-worker` can accidentally build the root LibreChat app and crash with missing `MONGO_URI`.

- Missing TTS env wiring
  The voice feature is not live unless `TTS_BASE_URL` and `TTS_API_KEY` exist on `LibreChat`.

- Missing dedicated TTS service target
  If `kyns-tts` is deployed from the wrong path, the feature may appear configured in `librechat.yaml` but fail at runtime.

## Pre-Deploy Audit

Run this before a manual redeploy:

```bash
python3 config/railway-audit-services.py
```

The script flags:

- failed/crashed latest deployments
- invalid regions
- unexpected builders
- missing critical LibreChat env wiring
