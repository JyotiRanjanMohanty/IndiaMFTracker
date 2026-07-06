# India MF Portfolio Tracker

A full-stack web application for Indian investors to analyse their SIP portfolio's true allocation across sectors and market caps — powered by Morningstar India and Groww scraping.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/mf-tracker run dev` — run the frontend (port 18572)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Recharts
- API: Express 5
- Scraping: Axios + Cheerio
- Fund data: mfapi.in (AMFI database)
- Sector data: Morningstar India (factsheet scraping)
- Market cap: Groww (fund page scraping)
- Validation: Zod + Orval codegen from OpenAPI spec

## Where things live

- `artifacts/mf-tracker/src/` — React frontend (Home/Analysis/About pages)
- `artifacts/api-server/src/lib/` — Scraper services (fundSearch, morningstarScraper, growwScraper)
- `artifacts/api-server/src/routes/` — API routes (funds, portfolio, source download)
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 contract (source of truth)
- `lib/api-client-react/src/generated/` — Generated React Query hooks
- `lib/api-zod/src/generated/` — Generated Zod schemas

## Architecture decisions

- Contract-first: OpenAPI spec drives both frontend hooks (Orval → React Query) and backend validation (Zod schemas)
- In-memory 4-hour cache for Morningstar and Groww scraping results to reduce load on source sites
- Name-similarity check (token overlap ≥ 0.25) before accepting scraper search results to prevent wrong fund matching
- Source download zips the project at request time using adm-zip; dotfiles and .env-adjacent files are excluded for security
- SIP validation enforces both per-fund [0,100] bounds and sum ≈ 100% (±0.5%) at the backend

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Morningstar and Groww scrapers depend on those sites' HTML/JS structure — may need updates if they change
- Source download (~`GET /api/source/download`) has no auth; in production consider gating it
- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any openapi.yaml change
