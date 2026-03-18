# Contributing to KYNS

Thank you for your interest in contributing! This is the official open-source repository for the KYNS platform.

## How It Works

This is a **community edition** model:
- The `main` branch reflects the production codebase
- Community contributions come in via Pull Requests
- The KYNS team reviews and cherry-picks what goes into production

## Getting Started

### Prerequisites

- Node.js v20.19.0+ or v22.12.0+
- MongoDB (local or Atlas)
- npm

### Local Setup

```bash
# Clone the repo
git clone https://github.com/Kyns-ai/kyns.git
cd kyns

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your values (MongoDB URI, API keys, etc.)

# Install dependencies and build
npm run smart-reinstall

# Start the backend
npm run backend

# In another terminal, start the frontend dev server
npm run frontend:dev
```

The backend runs on `http://localhost:3080` and the frontend dev server on `http://localhost:3090`.

### Generating Required Secrets

```bash
# CREDS_KEY (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CREDS_IV (32 hex chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# JWT_SECRET and JWT_REFRESH_SECRET (64 hex chars each)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Submitting a Pull Request

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following the code style below
4. Run the build to make sure nothing is broken: `npm run build`
5. Open a PR against `main` with a clear description of what and why

## Code Style

- **TypeScript** for all new backend code (in `packages/api/`)
- **Never-nesting**: early returns, flat code
- **No `any`**: explicit types everywhere
- **No duplicate types**: check `packages/data-provider/src/types` first
- All user-facing text must use `useLocalize()` (English keys in `client/src/locales/en/translation.json`)
- Fix all ESLint/TypeScript warnings before submitting

## Project Structure

| Directory | Purpose |
|---|---|
| `api/` | Express backend (JS, legacy) |
| `packages/api/` | New backend code (TypeScript) |
| `packages/data-provider/` | Shared types and API endpoints |
| `client/` | React frontend |
| `config/` | Admin utility scripts |

## Questions?

Open an issue or reach out at [contact@kyns.ai](mailto:contact@kyns.ai).
