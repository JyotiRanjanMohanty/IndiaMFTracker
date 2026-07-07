# India Mutual Fund Portfolio Tracker

A full-stack web application to analyse your India mutual fund SIP portfolio's
sector allocation and market capitalisation distribution.

## Features

- **Fund Search** — Auto-complete search powered by the AMFI fund database (mfapi.in)
- **Portfolio Builder** — Add multiple funds with SIP % allocation (must sum to 100%)
- **Sector Allocation Analysis**
  - Equity / Debt / Cash split derived from each fund's SEBI category
  - Three super-sectors: Cyclical, Sensitive, Defensive
  - 11 subsectors: Financial Services, Consumer Cyclical, Basic Materials, Real Estate,
    Technology, Industrials, Energy, Communication Services,
    Healthcare, Consumer Defensive, Utilities
  - Dual-ring pie chart + subsector breakdown with progress bars
- **Market Cap Analysis** — Large / Mid / Small cap split from SEBI-mandated category data
- **Interactive Charts** — Recharts dual-ring sector chart + pie charts
- **Source Download** — Download full source code as a ZIP archive

> **Data note:** Sector and market-cap figures are category-typical estimates
> derived from each fund's SEBI scheme category (e.g. "Equity Scheme – Flexi Cap Fund")
> using SEBI-mandated allocation ranges, not real-time holdings data.
> The Morningstar India and Groww portals have blocked all server-side API access;
> mfapi.in (AMFI data) is used as the sole live data source.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 6 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| State / Data | TanStack React Query v5 |
| Routing | Wouter |
| Backend | Node.js 24 + Express 5 + TypeScript |
| API Contract | OpenAPI 3.1 → Orval codegen |
| HTTP Client (server) | Axios |
| Fund Metadata | AMFI via mfapi.in |
| Sector / Market Cap | SEBI category model |
| Monorepo | pnpm workspaces |
| Schema Validation | Zod |

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── fundSearch.ts          # AMFI fund list loader + fuzzy search
│   │       │   ├── morningstarScraper.ts  # Sector + asset allocation (SEBI category model)
│   │       │   └── growwScraper.ts        # Market cap allocation (SEBI category model)
│   │       └── routes/
│   │           ├── funds.ts               # GET /api/funds/search|morningstar|groww
│   │           ├── portfolio.ts           # POST /api/portfolio/analyze
│   │           └── source.ts              # GET /api/source/download
│   └── mf-tracker/          # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── home.tsx               # Portfolio builder UI
│           │   └── analysis.tsx           # Results, charts, and breakdowns
│           ├── lib/
│           │   └── store.tsx              # Global state (Zustand)
│           └── App.tsx
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml     # OpenAPI 3.1 contract (source of truth)
│   ├── api-client-react/    # Orval-generated React Query hooks
│   └── api-zod/             # Orval-generated Zod schemas
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Data Flow

1. **User searches** a fund name → frontend calls `GET /api/funds/search?q=...`
2. **User builds portfolio** — assigns SIP % to each fund (must total 100%)
3. **Analyse** — frontend calls `POST /api/portfolio/analyze`
4. **API server** for each fund:
   a. Calls mfapi.in to resolve the AMFI scheme code + SEBI category
   b. Applies category-based allocation model → equity/debt/cash + 11 sector weights
   c. Applies SEBI market-cap mandate model → large/mid/small cap split
   d. Computes SIP-weighted aggregates across all funds
5. **Frontend renders**:
   - Equity / Debt / Cash allocation pie
   - Market cap pie (Large / Mid / Small)
   - Sector dual-ring chart (centre: super-sectors; ring: 11 subsectors)
   - Subsector breakdown with labelled progress bars
   - Per-fund contribution cards

## Local Setup

### Prerequisites

- **Node.js 20+** (Node 24 recommended — matches the Replit environment)
- **pnpm 9+** — install via `npm install -g pnpm`

### 1 — Clone and install

```bash
git clone <repo-url>
cd <repo-folder>
pnpm install
```

### 2 — Set the session secret

Create a `.env` file in the repo root (only required by the API server for cookie signing):

```env
SESSION_SECRET=any-random-string-here
```

No database or external API key is required.

### 3 — Run in development (two terminals)

**Terminal A — API Server** (runs on port 5000 by default):

```bash
PORT=5000 pnpm --filter @workspace/api-server run dev
```

**Terminal B — Frontend** (runs on port 5173 by default):

```bash
PORT=5173 pnpm --filter @workspace/mf-tracker run dev
```

Open **http://localhost:5173** in your browser.

> The Vite dev server already proxies `/api/*` to port 5000.
> If you change the API port, update `server.proxy` in
> `artifacts/mf-tracker/vite.config.ts` accordingly.

### 4 — Build for production

```bash
# Build API server
pnpm --filter @workspace/api-server run build

# Build frontend
pnpm --filter @workspace/mf-tracker run build

# Serve API (from dist/)
PORT=5000 node artifacts/api-server/dist/index.js
```

### Regenerate API client (after editing openapi.yaml)

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react/` and `lib/api-zod/` from the OpenAPI spec.

## Data Sources

| Source | Usage | Access |
|--------|-------|--------|
| [mfapi.in](https://api.mfapi.in/mf) | Fund search, scheme code, SEBI category | Free, no auth |
| Morningstar India XML search | Fund URL lookup only (for deep-link) | Free endpoint |
| SEBI category model | Sector + market cap allocation | Built-in (no network call) |

## Caveats

- Sector and market-cap data are **category-level estimates**, not per-fund holdings.
  Funds in the same SEBI category share the same model allocation.
- All data is cached in-memory (6 h TTL) — no persistent database required.
- The app has no login or user accounts; portfolio state lives in the browser session.
