import axios from "axios";
import { logger } from "./logger";

export interface MarketCapAllocation {
  largeCap: number;
  midCap: number;
  smallCap: number;
  others: number;
}

export interface GrowwData {
  fundName: string;
  growwUrl: string | null;
  marketCap: MarketCapAllocation;
  isEstimated: boolean;
}

// ── mfapi.in types ────────────────────────────────────────────────────────────

interface MfapiSearchResult {
  schemeCode: number;
  schemeName: string;
}

interface MfapiMeta {
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
  scheme_code: number;
  scheme_name: string;
}

// ── Category → market cap profile ────────────────────────────────────────────
// Based on SEBI-mandated minimum allocations per category.
// Large cap = top 100 companies by market cap (SEBI definition)
// Mid cap = 101–250, Small cap = 251+

function marketCapFromCategory(category: string): MarketCapAllocation {
  const cat = category.toLowerCase();

  // Debt / Liquid / Money Market — no equity, so market cap is irrelevant; use "others"
  if (
    cat.includes("debt") || cat.includes("liquid") || cat.includes("money market") ||
    cat.includes("overnight") || cat.includes("gilt") || cat.includes("credit risk") ||
    cat.includes("banking and psu") || cat.includes("duration") || cat.includes("floater") ||
    cat.includes("fixed maturity")
  ) {
    return { largeCap: 0, midCap: 0, smallCap: 0, others: 100 };
  }

  // Conservative hybrid (low equity)
  if (cat.includes("conservative hybrid")) {
    return { largeCap: 16, midCap: 5, smallCap: 1, others: 78 };
  }

  // Equity savings / Arbitrage (partial equity)
  if (cat.includes("equity savings") || cat.includes("arbitrage")) {
    return { largeCap: 25, midCap: 8, smallCap: 2, others: 65 };
  }

  // Balanced Advantage / Dynamic Asset Allocation
  if (cat.includes("balanced advantage") || cat.includes("dynamic asset")) {
    return { largeCap: 42, midCap: 18, smallCap: 5, others: 35 };
  }

  // Aggressive Hybrid
  if (cat.includes("aggressive hybrid")) {
    return { largeCap: 48, midCap: 20, smallCap: 7, others: 25 };
  }

  // Multi Asset / Fund of Funds
  if (cat.includes("multi asset") || cat.includes("fund of funds")) {
    return { largeCap: 33, midCap: 14, smallCap: 3, others: 50 };
  }

  // Other hybrid
  if (cat.includes("hybrid") || cat.includes("balanced")) {
    return { largeCap: 39, midCap: 16, smallCap: 5, others: 40 };
  }

  // ── Pure Equity — more-specific categories first ──

  // SEBI mandates min 35% large, min 35% mid — check before individual "large cap"/"mid cap"
  if (cat.includes("large & mid cap") || cat.includes("large and mid cap") || cat.includes("large midcap")) {
    return { largeCap: 50, midCap: 38, smallCap: 2, others: 10 };
  }

  // SEBI mandates min 80% in top 100 stocks
  if (cat.includes("large cap")) {
    return { largeCap: 82, midCap: 8, smallCap: 0, others: 10 };
  }

  // SEBI mandates min 65% in 101–250 stocks
  if (cat.includes("mid cap")) {
    return { largeCap: 8, midCap: 67, smallCap: 15, others: 10 };
  }

  // SEBI mandates min 65% in 251+ stocks
  if (cat.includes("small cap")) {
    return { largeCap: 2, midCap: 10, smallCap: 79, others: 9 };
  }

  // SEBI mandates min 65% in equity, free on cap distribution
  if (cat.includes("flexi cap")) {
    return { largeCap: 55, midCap: 23, smallCap: 9, others: 13 };
  }

  // SEBI mandates min 25% each in large, mid, small
  if (cat.includes("multi cap")) {
    return { largeCap: 33, midCap: 33, smallCap: 21, others: 13 };
  }

  // ELSS — typically large-cap biased
  if (cat.includes("elss") || cat.includes("tax saver")) {
    return { largeCap: 60, midCap: 22, smallCap: 8, others: 10 };
  }

  // Value / Contra — tend to be more mid/small-cap
  if (cat.includes("value") || cat.includes("contra")) {
    return { largeCap: 50, midCap: 28, smallCap: 12, others: 10 };
  }

  // Focused — concentrated, typically large-biased
  if (cat.includes("focused")) {
    return { largeCap: 63, midCap: 22, smallCap: 5, others: 10 };
  }

  // Dividend Yield — typically mid/large
  if (cat.includes("dividend yield")) {
    return { largeCap: 55, midCap: 25, smallCap: 8, others: 12 };
  }

  // Index funds / ETFs — strictly follow index composition
  if (cat.includes("index") || cat.includes("etf")) {
    if (cat.includes("small") || cat.includes("250")) {
      return { largeCap: 5, midCap: 15, smallCap: 78, others: 2 };
    }
    if (cat.includes("mid")) {
      return { largeCap: 5, midCap: 93, smallCap: 0, others: 2 };
    }
    // Default index (Nifty 50 / Nifty 100)
    return { largeCap: 97, midCap: 1, smallCap: 0, others: 2 };
  }

  // Sectoral / Thematic — depends on sector; use broad equity weights
  if (cat.includes("sectoral") || cat.includes("thematic")) {
    return { largeCap: 58, midCap: 24, smallCap: 9, others: 9 };
  }

  // Generic equity fallback
  return { largeCap: 55, midCap: 24, smallCap: 10, others: 11 };
}

// ── Name similarity helper ────────────────────────────────────────────────────

function nameSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const tokA = new Set(tokenize(a));
  const tokB = new Set(tokenize(b));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokA) if (tokB.has(t)) overlap++;
  return overlap / Math.max(tokA.size, tokB.size);
}

const MIN_NAME_SIMILARITY = 0.25;

// ── mfapi.in category lookup (shared cache) ───────────────────────────────────

const schemeCategoryCache = new Map<string, { category: string; ts: number }>();
const SCHEME_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getSchemeCategory(fundName: string): Promise<string> {
  const cacheKey = fundName.toLowerCase().trim();
  const cached = schemeCategoryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCHEME_CACHE_TTL) {
    return cached.category;
  }

  try {
    const q = encodeURIComponent(fundName.slice(0, 60));
    const searchResp = await axios.get<MfapiSearchResult[]>(
      `https://api.mfapi.in/mf/search?q=${q}`,
      { timeout: 10_000, headers: { Accept: "application/json" } }
    );
    const results = searchResp.data ?? [];
    if (results.length === 0) return "";

    // Apply name-similarity guard before picking a result
    const viable = results.filter(
      (r) => nameSimilarity(fundName, r.schemeName) >= MIN_NAME_SIMILARITY
    );
    if (viable.length === 0) {
      logger.warn({ fundName, firstResult: results[0]?.schemeName }, "No mfapi results passed similarity check (groww)");
      return "";
    }

    const preferred =
      viable.find(
        (r) =>
          r.schemeName.toLowerCase().includes("direct") &&
          r.schemeName.toLowerCase().includes("growth")
      ) ?? viable[0];

    const detailResp = await axios.get<{ meta: MfapiMeta }>(
      `https://api.mfapi.in/mf/${preferred.schemeCode}`,
      { timeout: 10_000, headers: { Accept: "application/json" } }
    );
    const category = detailResp.data.meta.scheme_category;
    schemeCategoryCache.set(cacheKey, { category, ts: Date.now() });
    logger.info({ fundName, category }, "Got AMFI scheme category for market cap");
    return category;
  } catch (err) {
    logger.warn({ err, fundName }, "mfapi.in category lookup failed (groww)");
    return "";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: GrowwData; ts: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function getGrowwData(fundName: string): Promise<GrowwData> {
  const cacheKey = fundName.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  logger.info({ fundName }, "Computing market cap via AMFI scheme category");

  const category = await getSchemeCategory(fundName);
  const marketCap = marketCapFromCategory(category);

  const data: GrowwData = {
    fundName,
    growwUrl: null,
    marketCap,
    isEstimated: true,
  };

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}
