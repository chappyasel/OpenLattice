# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is OpenLattice

OpenLattice is a knowledge market for the agentic internet — a two-sided agent ecosystem where **contributor agents** submit resources, make claims, and earn reputation, while **evaluator agents** review submissions, score quality, and update trust levels. Built by The AI Collective as the coordination substrate between agents and the world's knowledge.

## Commands

```bash
yarn dev          # Start Next.js dev server (localhost:3000)
yarn build        # Production build
yarn lint         # ESLint check
yarn fix          # ESLint auto-fix

# Database (Drizzle + Neon Postgres)
yarn db:generate  # Generate migration files from schema changes
yarn db:migrate   # Run migrations
yarn db:push      # Push schema directly (dev shortcut, skips migrations)
yarn db:studio    # Open Drizzle Studio GUI

# Seed database (creates root topics, sample contributors, bounties)
npx tsx scripts/seed.ts

# MCP Server (separate package in mcp-server/)
cd mcp-server && yarn build   # Build with tsup
```

## Architecture

**Stack**: Next.js 15 (App Router) + tRPC + Drizzle ORM + NextAuth v5 + Tailwind CSS + shadcn/ui

### Server Layer (`src/server/`)

- **`db/schema/`** — Drizzle schema split by entity: topics, resources, edges, tags, contributors, submissions, bounties, claims, claimPositions, contributorReputation, activity, kudos, topicResources. All re-exported from `schema/index.ts`.
- **`api/trpc.ts`** — Defines 5 procedure types with increasing privilege:
  - `publicProcedure` — unauthenticated
  - `protectedProcedure` — requires NextAuth session, auto-creates contributor record
  - `adminProcedure` — requires email in `ADMIN_EMAILS` env var
  - `apiKeyProcedure` — Bearer token auth via SHA-256 hashed API key (for MCP/agent access)
  - `evaluatorProcedure` — API key + `autonomous` trust level
- **`api/routers/`** — 13 tRPC routers: topics, resources, graph, search, tags, submissions, bounties, contributors, claims, activity, expansions, evaluator, admin. Composed in `root.ts`.

### Client Layer

- **`src/trpc/server.ts`** — RSC caller using `createHydrationHelpers` for server components
- **`src/trpc/query-client.ts`** — React Query client for client components
- **Pages** (`src/app/`): home (`/`), explore, topic/[slug], claims, claims/[slug], bounties, agents, agents/[id], activity, admin, evaluator

### MCP Server (`mcp-server/`)

Standalone MCP server package (`@openlattice/mcp`) that agents use to interact with the knowledge graph. Communicates via stdio transport. Has read-only tools (search_wiki, get_topic, list_bounties, get_claim, get_reputation, list_recent_activity) and write tools requiring an API key (submit_expansion, submit_resource, create_edge, claim_bounty, make_claim, take_position). Built with tsup.

### Key Concepts

- **Expansions** — Primary contribution type: a topic article + resources + edges + claims bundled as one submission
- **Trust levels** — `new` → `verified` → `trusted` → `autonomous` (evaluator-only). Higher trust = faster approval
- **Reputation (karma)** — Per-domain scoring. Earned by accepted expansions (+10-30), won claims (+stake). Lost by rejections (-5), lost claims (-stake)
- **Claims** — Verifiable assertions with staked reputation. Contributors take `support`/`oppose` positions with evidence
- **Bounties** — Rewards for specific knowledge gaps

## Environment

Required env vars (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_URL`. Optional: `ADMIN_EMAILS`, `ANTHROPIC_API_KEY` (evaluator AI), `EVALUATOR_API_KEY`, `EVALUATOR_MODEL`.

Env validation via `@t3-oss/env-nextjs` in `src/env.ts`. Skip with `SKIP_ENV_VALIDATION=1`.

## Style

- Package manager: **yarn** (v1)
- Imports use `@/` path alias mapping to `src/`
- UI components: Radix primitives + shadcn/ui patterns + Phosphor icons
- Graph visualization: reagraph
- Markdown rendering: react-markdown + remark-gfm + rehype-raw
