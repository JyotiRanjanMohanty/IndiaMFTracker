import { Router, type IRouter } from "express";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const README_CONTENT = `# India Mutual Fund Portfolio Tracker

A full-stack web application to track and analyse your India mutual fund portfolio's
sector allocation and market cap distribution.

## Features

- **Fund Search**: Auto-complete fund search powered by the AMFI mutual fund database
- **Portfolio Builder**: Add multiple funds with SIP % allocation (must sum to 100%)
- **Sector Allocation Analysis**:
  - Equity / Debt / Cash split from Morningstar India
  - Three high-level sectors: Cyclical, Sensitive, Defensive
  - 11 sub-sectors (4 Cyclical + 4 Sensitive + 3 Defensive) from Morningstar factsheets
- **Market Cap Analysis**: Large / Mid / Small cap split from Groww
- **Interactive Charts**: Recharts pie charts and dual-ring sector charts
- **Source Download**: Download the full source code as a ZIP archive

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| State / Data | TanStack React Query |
| Routing | Wouter |
| Backend | Node.js + Express 5 + TypeScript |
| API Contract | OpenAPI 3.1 (Orval codegen) |
| Web Scraping | Axios + Cheerio |
| Fund Data | AMFI via mfapi.in |
| Sector Data | Morningstar India (factsheet scraping) |
| Market Cap | Groww (page scraping) |
| Monorepo | pnpm workspaces |
| Validation | Zod |

## Project Structure

\`\`\`
.
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── fundSearch.ts          # AMFI fund search
│   │       │   ├── morningstarScraper.ts  # Morningstar data
│   │       │   └── growwScraper.ts        # Groww market cap data
│   │       └── routes/
│   │           ├── funds.ts               # /api/funds/* routes
│   │           ├── portfolio.ts           # /api/portfolio/analyze
│   │           └── source.ts              # /api/source/download
│   └── mf-tracker/          # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── home.tsx               # Portfolio builder
│           │   └── analysis.tsx           # Results & charts
│           └── App.tsx
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml     # OpenAPI 3.1 contract
│   ├── api-client-react/    # Generated React Query hooks
│   └── api-zod/             # Generated Zod schemas
└── README.md
\`\`\`

## Code Execution Flow

1. **Frontend loads** — fetches fund suggestions as user types (debounced)
2. **User builds portfolio** — enters fund names (auto-suggest) + SIP %
3. **Validate** — SIP percentages must sum to 100%
4. **Analyze Portfolio** — POST \`/api/portfolio/analyze\`
5. **API Server**:
   a. Fetches Morningstar India factsheet for each fund (scraping + caching)
   b. Fetches Groww fund page for each fund (scraping + caching)
   c. Computes weighted-average aggregations across all funds
   d. Returns combined analysis JSON
6. **Frontend renders** charts:
   - Equity / Debt / Cash / Other asset allocation pie
   - Sector allocation dual-ring chart (outer: Cyclical/Sensitive/Defensive; inner: 11 subsectors)
   - Market cap pie chart (Large / Mid / Small / Others)
   - Per-fund breakdown cards

## Local Setup

### Prerequisites

- Node.js 20+
- pnpm 9+ (\`npm install -g pnpm\`)

### Install

\`\`\`bash
git clone <repo>
cd <repo>
pnpm install
\`\`\`

### Environment Variables

Create a \`.env\` file (or export in terminal):

\`\`\`env
DATABASE_URL=postgresql://localhost:5432/mftracker   # optional, not required for core features
\`\`\`

### Run in Development

Terminal 1 — API Server:
\`\`\`bash
PORT=5000 pnpm --filter @workspace/api-server run dev
\`\`\`

Terminal 2 — Frontend:
\`\`\`bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/mf-tracker run dev
\`\`\`

Then open **http://localhost:5173**

The frontend's Vite dev server proxies \`/api/*\` calls to the API server on port 5000.
If you run both services, add a Vite proxy config in \`artifacts/mf-tracker/vite.config.ts\`:

\`\`\`ts
server: {
  proxy: {
    '/api': 'http://localhost:5000'
  }
}
\`\`\`

### Regenerate API Client (after changing openapi.yaml)

\`\`\`bash
pnpm --filter @workspace/api-spec run codegen
\`\`\`

### Build for Production

\`\`\`bash
pnpm run build
\`\`\`

## Data Sources

| Source | Usage | Notes |
|--------|-------|-------|
| [mfapi.in](https://api.mfapi.in/mf) | Fund name autocomplete | Free, comprehensive AMFI list |
| [Morningstar India](https://www.morningstar.in) | Equity/debt/cash split, sector allocation | Scraping factsheet pages |
| [Groww](https://groww.in) | Market cap breakdown | Scraping fund pages |

## Notes on Scraping

- Results are cached in-memory for 4 hours to reduce load on source sites
- Some funds may not be found if the name doesn't match the site's search index
- Scraping may break if Morningstar or Groww update their HTML/JS structure
`;

function addDirToZip(zip: AdmZip, srcPath: string, zipPrefix: string): void {
  if (!fs.existsSync(srcPath)) return;

  const IGNORE = new Set([
    "node_modules", "dist", ".git", "pnpm-lock.yaml",
    ".cache", ".turbo", ".tsbuildinfo",
  ]);
  // Security: never include dotfiles or secret-adjacent files
  const SECRET_PATTERNS = /^\.env|\.pem$|\.key$|\.p12$|\.pfx$|\.crt$|\.cer$|secrets?\./i;

  function walk(dir: string, zipDir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const zipPath = path.join(zipDir, entry.name);
      // Skip dotfiles and secret-adjacent files for security
      if (entry.name.startsWith(".") || SECRET_PATTERNS.test(entry.name)) continue;
      if (entry.isDirectory()) {
        walk(fullPath, zipPath);
      } else if (entry.isFile()) {
        try {
          zip.addLocalFile(fullPath, path.dirname(zipPath));
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  walk(srcPath, zipPrefix);
}

// GET /source/download
router.get("/source/download", async (req, res): Promise<void> => {
  req.log.info("Source download requested");

  // api-server runs from dist/ so workspace root is two levels up
  const workspaceRoot = path.resolve(process.cwd(), "../..");

  try {
    const zip = new AdmZip();

    // Add README
    zip.addFile("README.md", Buffer.from(README_CONTENT, "utf-8"));

    // Add project directories (excluding node_modules, dist, etc.)
    const dirs: Array<[string, string]> = [
      ["artifacts/mf-tracker", "artifacts/mf-tracker"],
      ["artifacts/api-server", "artifacts/api-server"],
      ["lib/api-spec", "lib/api-spec"],
      ["lib/api-client-react", "lib/api-client-react"],
      ["lib/api-zod", "lib/api-zod"],
      ["lib/db", "lib/db"],
    ];

    for (const [srcRel, zipDir] of dirs) {
      addDirToZip(zip, path.join(workspaceRoot, srcRel), zipDir);
    }

    // Add root config files
    const rootFiles = ["package.json", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json"];
    for (const f of rootFiles) {
      const fp = path.join(workspaceRoot, f);
      if (fs.existsSync(fp)) {
        zip.addLocalFile(fp);
      }
    }

    const buffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="india-mf-tracker-source.zip"');
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err: unknown) {
    req.log.error({ err }, "Source archive error");
    res.status(500).json({ error: "Failed to create archive" });
  }
});

export default router;
