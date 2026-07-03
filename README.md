# Reactive Resume

Reactive Resume is a self-hostable resume builder for one owner. Create, import, edit, export, and share resumes from a
focused web interface. The builder includes an optional AI assistant for improving the resume currently being edited.

## What it does

- Builds resumes with live PDF previews and configurable templates.
- Imports resume data and exports PDF, DOCX, and JSON.
- Supports rich text, custom sections, page layout, fonts, colors, and spacing.
- Shares resumes through public links with optional password protection.
- Integrates AI providers including OpenAI, Anthropic, Google Gemini, and compatible custom endpoints.
- Stores uploads on the local filesystem by default; S3-compatible storage is optional.

The first account created on an instance becomes its owner. Registration then closes automatically. The application does not
provide teams, organizations, billing, tenant administration, or collaboration workflows.

## Self-host with Docker

Requirements: Docker with Compose support.

```bash
git clone --depth=1 https://github.com/amruthpillai/reactive-resume.git
cd reactive-resume
cp .env.example .env
```

Before starting, edit `.env` and set at least:

```dotenv
APP_URL="https://resume.example.com"
AUTH_SECRET="replace-with-a-random-secret"
ENCRYPTION_SECRET="replace-with-another-random-secret"
```

Generate secrets with `openssl rand -hex 32`. For local-only use, the default `APP_URL` is sufficient.

Start the application:

```bash
docker compose up -d --build
```

Open `APP_URL` and create the owner account. The default stack runs:

- the application on port 3000;
- PostgreSQL for account and resume data;
- Redis for AI assistant coordination;
- local upload storage in `./data`.

PostgreSQL and Redis data are kept in Docker volumes. Back up those volumes and `./data` together. SMTP, social login,
S3-compatible storage, and custom OAuth are optional and documented inline in `.env.example`.

## AI assistant

After signing in, open **Settings → Integrations** and add an AI provider. Provider credentials are encrypted using
`ENCRYPTION_SECRET`. The assistant is available inside the resume builder and works on the active resume.

No AI provider is required for the core resume workflow.

## Local development

Requirements: Node.js, pnpm, Docker, and dotenvx.

```bash
pnpm install
cp .env.example .env.local
sudo docker compose -f compose.dev.yml up -d postgres
dotenvx run -f .env.local -- pnpm dev
```

The application is available at `http://localhost:3000`. To use the AI assistant during local development, also start Redis
with `sudo docker compose -f compose.dev.yml up -d redis` and set `REDIS_URL="redis://localhost:6379"` in `.env.local`.

Common checks:

```bash
pnpm --filter web typecheck
pnpm --filter server typecheck
pnpm test
pnpm exec turbo boundaries
```

## Architecture

This pnpm/Turborepo workspace has two deployable apps:

- `apps/web`: TanStack Start and React resume interface.
- `apps/server`: Hono server for auth, RPC, MCP, static files, and startup migrations.

Shared domain, rendering, and infrastructure code lives in `packages/`. See `AGENTS.md` for package boundaries and development
conventions.

## License

[MIT](./LICENSE)
