<p align="center">
  <a href="https://kyns.ai">
    <img src="client/public/assets/logo.svg" height="96">
  </a>
</p>

<h1 align="center">KYNS</h1>

<p align="center">
  An uncensored AI platform for authentic, unfiltered conversations.
  <br />
  <a href="https://kyns.ai"><strong>kyns.ai</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Kyns-ai/kyns/issues">Report a Bug</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Kyns-ai/kyns/issues">Request a Feature</a>
</p>

---

## What is KYNS?

KYNS is an open-source AI platform that provides direct, unfiltered access to large language models. No content restrictions. No moralizing. No forced disclaimers.

Built on top of [LibreChat](https://github.com/danny-avila/LibreChat) with extensive customizations for performance, privacy, and user experience.

**Live platform:** [kyns.ai](https://kyns.ai)

---

## Features

- **Uncensored conversations** — no content filters, no topic restrictions
- **Multiple AI modes** — Normal (fast) and Deep (reasoning) modes
- **Image generation** — integrated image generation via RunPod
- **Privacy-first** — conversations deleted from server after 24 hours
- **AI memory** — optional persistent memory across conversations
- **Web search** — real-time search integration
- **Voice** — text-to-speech support
- **Self-hostable** — run your own instance with your own API keys

---

## Running Locally

### Prerequisites

- Node.js v20.19.0+ or v22.12.0+
- MongoDB (local or [Atlas free tier](https://www.mongodb.com/atlas))
- npm

### Setup

```bash
# Clone
git clone https://github.com/Kyns-ai/kyns.git
cd kyns

# Configure environment
cp .env.example .env
# Edit .env — at minimum set MONGO_URI and the JWT/CREDS secrets

# Generate required secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # CREDS_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # CREDS_IV
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_REFRESH_SECRET

# Install and build
npm run smart-reinstall

# Start backend
npm run backend

# Start frontend (separate terminal)
npm run frontend:dev
```

Backend runs on `http://localhost:3080`, frontend dev server on `http://localhost:3090`.

### Docker

```bash
cp .env.example .env
# Edit .env with your values
docker compose up
```

---

## Configuration

Copy `librechat.example.yaml` to `librechat.yaml` and customize:

```bash
cp librechat.example.yaml librechat.yaml
```

Key configuration options are documented in [`librechat.example.yaml`](librechat.example.yaml).

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

This is a **community edition** model — the KYNS team reviews PRs and cherry-picks what goes into production. The `main` branch reflects the production codebase.

---

## License

MIT License — see [LICENSE](LICENSE).

The **KYNS** name and brand are trademarks of KYNS LLC. See [NOTICE.md](NOTICE.md).

Built on [LibreChat](https://github.com/danny-avila/LibreChat) © 2023 Danny Avila.
