# Your First Customer

An AI agent swarm that lands your first paying B2B customer. Part of [AlignWorks](https://alignworks.com).

## Stack

- **Frontend**: Astro 5 + React 18 islands + TypeScript + Tailwind 3
- **Runtime**: Cloudflare Workers + Durable Objects + D1 + KV
- **Agents**: Claude claude-sonnet-4-6 via Anthropic SDK
- **Enrichment**: Apollo.io API
- **Outbound**: Toflow.ai API
- **Deploy**: GitHub Actions → Cloudflare Pages

## Local setup

```bash
npm install
```

### One-time Cloudflare resource setup

```bash
# Create D1 database
npx wrangler d1 create yfc-db
# Copy the database_id into wrangler.toml

# Create KV namespace
npx wrangler kv namespace create yfc-cache
# Copy the id into wrangler.toml

# Run DB migrations
npm run cf:d1:init
```

### Set secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put APOLLO_API_KEY
npx wrangler secret put TOFLOW_API_KEY
```

### GitHub Actions secrets

Add these in repo Settings → Secrets → Actions:
- `CLOUDFLARE_API_TOKEN` — from Cloudflare dashboard → My Profile → API Tokens
- `ANTHROPIC_API_KEY`

### Dev server

```bash
npm run dev
```

### Deploy

Push to `main` — GitHub Actions handles the rest.

## Agent flow

```
Intake form → /api/session/create
  → Apollo enrichment (person + org)
  → /api/agents/score     (Claude: readiness scoring)
  → /api/agents/icp       (Claude: ICP + persona)
  → /api/agents/playbook  (Claude: GTM playbook + Apollo: target list)
  → Dashboard
```

## Project structure

```
src/
  pages/
    index.astro             # Intake flow
    dashboard.astro         # Milestone tracker
    api/
      session/create.ts     # Session init + Apollo enrichment
      session/[id].ts       # Session state read
      agents/
        score.ts            # Readiness scoring agent
        icp.ts              # ICP builder agent
        playbook.ts         # GTM playbook + target list agent
  components/
    IntakeFlow.tsx          # Multi-step intake form
    Dashboard.tsx           # Session dashboard
  lib/
    claude.ts               # Anthropic client helpers
    apollo.ts               # Apollo API helpers
durable-objects/
  FounderSession.ts         # Per-session state machine
db/
  schema.sql                # D1 schema
```
