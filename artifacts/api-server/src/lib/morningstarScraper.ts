import axios from "axios";
import { logger } from "./logger";

export interface SectorAllocation {
  cyclical: number;
  sensitive: number;
  defensive: number;
  financialServices: number;
  realEstate: number;
  consumerCyclical: number;
  basicMaterials: number;
  communicationServices: number;
  energy: number;
  industrials: number;
  technology: number;
  consumerDefensive: number;
  healthcare: number;
  utilities: number;
}

export interface MorningstarData {
  fundName: string;
  morningstarUrl: string | null;
  equityPercent: number;
  debtPercent: number;
  cashPercent: number;
  otherPercent: number;
  sectors: SectorAllocation;
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

// ── Sector weight profiles ────────────────────────────────────────────────────
// Weights represent fraction of *equity portion* allocated to each subsector.
// Source: Morningstar/AMFI category-average compositions for Indian funds.

type SubSectorWeights = Omit<SectorAllocation,
  "cyclical" | "sensitive" | "defensive">;

/** Broad Indian equity market (Nifty 500 approximation) */
const BROAD_EQUITY: SubSectorWeights = {
  financialServices: 0.29,
  technology: 0.17,
  consumerCyclical: 0.09,
  healthcare: 0.08,
  industrials: 0.08,
  energy: 0.07,
  consumerDefensive: 0.05,
  communicationServices: 0.05,
  basicMaterials: 0.05,
  realEstate: 0.02,
  utilities: 0.01,
};

/** Banking / Financial Services sectoral */
const BANKING_WEIGHTS: SubSectorWeights = {
  financialServices: 0.85,
  realEstate: 0.05,
  technology: 0.03,
  consumerCyclical: 0.03,
  industrials: 0.02,
  utilities: 0.01,
  consumerDefensive: 0.01,
  communicationServices: 0.00,
  energy: 0.00,
  basicMaterials: 0.00,
  healthcare: 0.00,
};

/** Technology / IT sectoral */
const TECH_WEIGHTS: SubSectorWeights = {
  technology: 0.80,
  communicationServices: 0.07,
  financialServices: 0.04,
  consumerCyclical: 0.03,
  industrials: 0.03,
  healthcare: 0.01,
  basicMaterials: 0.01,
  energy: 0.01,
  consumerDefensive: 0.00,
  realEstate: 0.00,
  utilities: 0.00,
};

/** Pharma / Healthcare sectoral */
const HEALTHCARE_WEIGHTS: SubSectorWeights = {
  healthcare: 0.85,
  consumerDefensive: 0.06,
  technology: 0.04,
  financialServices: 0.02,
  industrials: 0.02,
  basicMaterials: 0.01,
  consumerCyclical: 0.00,
  energy: 0.00,
  realEstate: 0.00,
  communicationServices: 0.00,
  utilities: 0.00,
};

/** Infrastructure / PSU / Industrials sectoral */
const INFRA_WEIGHTS: SubSectorWeights = {
  industrials: 0.35,
  energy: 0.22,
  basicMaterials: 0.16,
  utilities: 0.12,
  financialServices: 0.07,
  communicationServices: 0.04,
  realEstate: 0.02,
  consumerCyclical: 0.01,
  technology: 0.01,
  consumerDefensive: 0.00,
  healthcare: 0.00,
};

/** Consumer / FMCG sectoral */
const CONSUMER_WEIGHTS: SubSectorWeights = {
  consumerDefensive: 0.45,
  consumerCyclical: 0.30,
  healthcare: 0.10,
  financialServices: 0.06,
  basicMaterials: 0.04,
  communicationServices: 0.02,
  industrials: 0.01,
  technology: 0.01,
  energy: 0.01,
  realEstate: 0.00,
  utilities: 0.00,
};

// ── Profile builder ───────────────────────────────────────────────────────────

interface AllocationProfile {
  equityPercent: number;
  debtPercent: number;
  cashPercent: number;
  weights: SubSectorWeights;
}

function profileFromCategory(category: string, fundName: string): AllocationProfile {
  const cat = category.toLowerCase();
  const name = fundName.toLowerCase();

  // ── Debt / Liquid / Money Market ──
  if (
    cat.includes("debt") || cat.includes("liquid") || cat.includes("money market") ||
    cat.includes("overnight") || cat.includes("gilt") || cat.includes("credit risk") ||
    cat.includes("banking and psu") || cat.includes("duration") || cat.includes("floater") ||
    cat.includes("fixed maturity")
  ) {
    return { equityPercent: 0, debtPercent: 92, cashPercent: 8, weights: BROAD_EQUITY };
  }

  // ── Hybrid ──
  if (cat.includes("balanced advantage") || cat.includes("dynamic asset")) {
    return { equityPercent: 65, debtPercent: 28, cashPercent: 7, weights: BROAD_EQUITY };
  }
  if (cat.includes("aggressive hybrid")) {
    return { equityPercent: 75, debtPercent: 20, cashPercent: 5, weights: BROAD_EQUITY };
  }
  if (cat.includes("conservative hybrid")) {
    return { equityPercent: 22, debtPercent: 68, cashPercent: 10, weights: BROAD_EQUITY };
  }
  if (cat.includes("equity savings")) {
    return { equityPercent: 35, debtPercent: 45, cashPercent: 20, weights: BROAD_EQUITY };
  }
  if (cat.includes("multi asset") || cat.includes("fund of funds")) {
    return { equityPercent: 50, debtPercent: 35, cashPercent: 15, weights: BROAD_EQUITY };
  }
  if (cat.includes("hybrid") || cat.includes("balanced")) {
    return { equityPercent: 60, debtPercent: 33, cashPercent: 7, weights: BROAD_EQUITY };
  }
  if (cat.includes("arbitrage")) {
    return { equityPercent: 65, debtPercent: 25, cashPercent: 10, weights: BROAD_EQUITY };
  }

  // ── Sectoral / Thematic — determine weights from name/category ──
  let weights = BROAD_EQUITY;
  if (
    cat.includes("banking") || cat.includes("financial service") || cat.includes("bank and finance") ||
    name.includes("bank") || name.includes("financial service") || name.includes("banking")
  ) {
    weights = BANKING_WEIGHTS;
  } else if (
    cat.includes("technology") || cat.includes("information technology") ||
    name.includes(" tech") || name.includes("i.t.") || name.includes("it fund")
  ) {
    weights = TECH_WEIGHTS;
  } else if (
    cat.includes("pharma") || cat.includes("healthcare") ||
    name.includes("pharma") || name.includes("health")
  ) {
    weights = HEALTHCARE_WEIGHTS;
  } else if (
    cat.includes("infrastructure") || cat.includes("psu") ||
    name.includes("infra") || name.includes("psu")
  ) {
    weights = INFRA_WEIGHTS;
  } else if (
    cat.includes("consumption") || cat.includes("consumer") || cat.includes("fmcg") ||
    name.includes("consumption") || name.includes("fmcg")
  ) {
    weights = CONSUMER_WEIGHTS;
  }

  // ── Pure Equity — by SEBI category (order matters: more specific first) ──
  // "Large & Mid Cap" must be checked before "mid cap" and "large cap" individually
  if (cat.includes("large & mid cap") || cat.includes("large and mid cap") || cat.includes("large midcap")) {
    return { equityPercent: 90, debtPercent: 2, cashPercent: 8, weights };
  }
  if (cat.includes("large cap")) {
    return { equityPercent: 90, debtPercent: 2, cashPercent: 8, weights };
  }
  if (cat.includes("mid cap")) {
    return { equityPercent: 91, debtPercent: 1, cashPercent: 8, weights };
  }
  if (cat.includes("small cap")) {
    return { equityPercent: 91, debtPercent: 0, cashPercent: 9, weights };
  }
  if (cat.includes("flexi cap")) {
    return { equityPercent: 78, debtPercent: 3, cashPercent: 19, weights };
  }
  if (cat.includes("multi cap")) {
    return { equityPercent: 87, debtPercent: 2, cashPercent: 11, weights };
  }
  if (cat.includes("elss") || cat.includes("tax saver")) {
    return { equityPercent: 90, debtPercent: 2, cashPercent: 8, weights };
  }
  if (cat.includes("value") || cat.includes("contra")) {
    return { equityPercent: 85, debtPercent: 3, cashPercent: 12, weights };
  }
  if (cat.includes("focused")) {
    return { equityPercent: 85, debtPercent: 2, cashPercent: 13, weights };
  }
  if (cat.includes("dividend yield")) {
    return { equityPercent: 88, debtPercent: 2, cashPercent: 10, weights };
  }
  if (cat.includes("index") || cat.includes("etf")) {
    return { equityPercent: 99, debtPercent: 0, cashPercent: 1, weights };
  }
  if (cat.includes("sectoral") || cat.includes("thematic")) {
    return { equityPercent: 90, debtPercent: 1, cashPercent: 9, weights };
  }

  // Generic equity fallback
  return { equityPercent: 82, debtPercent: 5, cashPercent: 13, weights };
}

function computeSectors(profile: AllocationProfile): SectorAllocation {
  const eq = profile.equityPercent;
  const w = profile.weights;

  // Subsectors are expressed as % of total portfolio (equity_% × subsector_weight)
  const financialServices = +(eq * w.financialServices).toFixed(2);
  const realEstate = +(eq * w.realEstate).toFixed(2);
  const consumerCyclical = +(eq * w.consumerCyclical).toFixed(2);
  const basicMaterials = +(eq * w.basicMaterials).toFixed(2);
  const communicationServices = +(eq * w.communicationServices).toFixed(2);
  const energy = +(eq * w.energy).toFixed(2);
  const industrials = +(eq * w.industrials).toFixed(2);
  const technology = +(eq * w.technology).toFixed(2);
  const consumerDefensive = +(eq * w.consumerDefensive).toFixed(2);
  const healthcare = +(eq * w.healthcare).toFixed(2);
  const utilities = +(eq * w.utilities).toFixed(2);

  return {
    financialServices,
    realEstate,
    consumerCyclical,
    basicMaterials,
    communicationServices,
    energy,
    industrials,
    technology,
    consumerDefensive,
    healthcare,
    utilities,
    cyclical: +(financialServices + realEstate + consumerCyclical + basicMaterials).toFixed(2),
    sensitive: +(communicationServices + energy + industrials + technology).toFixed(2),
    defensive: +(consumerDefensive + healthcare + utilities).toFixed(2),
  };
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

// ── mfapi.in helpers ──────────────────────────────────────────────────────────

const schemeMetaCache = new Map<string, { meta: MfapiMeta; ts: number }>();
const SCHEME_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — AMFI categories don't change

async function getSchemeCategory(fundName: string): Promise<string> {
  const cacheKey = fundName.toLowerCase().trim();
  const cached = schemeMetaCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SCHEME_CACHE_TTL) {
    return cached.meta.scheme_category;
  }

  try {
    const q = encodeURIComponent(fundName.slice(0, 60));
    const searchResp = await axios.get<MfapiSearchResult[]>(
      `https://api.mfapi.in/mf/search?q=${q}`,
      { timeout: 10_000, headers: { Accept: "application/json" } }
    );
    const results = searchResp.data ?? [];
    if (results.length === 0) return "";

    // Apply name-similarity guard — reject results that don't match the query
    const viable = results.filter(
      (r) => nameSimilarity(fundName, r.schemeName) >= MIN_NAME_SIMILARITY
    );
    if (viable.length === 0) {
      logger.warn({ fundName, firstResult: results[0]?.schemeName }, "No mfapi results passed similarity check");
      return "";
    }

    // Among viable results prefer direct-plan growth option
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
    const meta = detailResp.data.meta;
    schemeMetaCache.set(cacheKey, { meta, ts: Date.now() });
    logger.info({ fundName, category: meta.scheme_category }, "Got AMFI scheme category");
    return meta.scheme_category;
  } catch (err) {
    logger.warn({ err, fundName }, "mfapi.in category lookup failed");
    return "";
  }
}

// ── Morningstar XML search — for the URL only ─────────────────────────────────

async function getMorningstarUrl(fundName: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(fundName.slice(0, 40));
    const resp = await axios.get<string>(
      `https://www.morningstar.in/handlers/AutoCompleteHandler.ashx?criteria=${q}`,
      {
        timeout: 8_000,
        responseType: "text",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
          Referer: "https://www.morningstar.in/",
          Accept: "application/xml, text/xml, */*",
        },
      }
    );

    const text = String(resp.data);
    const idMatch = text.match(/<ID>(F\w+)<\/ID>/i);
    const nameMatch = text.match(/<Name>([^<]+)<\/Name>/i);

    if (idMatch) {
      const secId = idMatch[1].toLowerCase();
      const displayName = nameMatch?.[1] ?? fundName;
      const slug = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+$/, "");
      return `https://www.morningstar.in/mutualfunds/${secId}/${slug}/fund-quote.aspx`;
    }
  } catch (err) {
    logger.warn({ err, fundName }, "Morningstar XML search failed");
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: MorningstarData; ts: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function getMorningstarData(fundName: string): Promise<MorningstarData> {
  const cacheKey = fundName.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  logger.info({ fundName }, "Computing Morningstar-style data via AMFI scheme category");

  // Fetch scheme category + Morningstar URL in parallel
  const [category, morningstarUrl] = await Promise.all([
    getSchemeCategory(fundName),
    getMorningstarUrl(fundName),
  ]);

  const profile = profileFromCategory(category, fundName);
  const sectors = computeSectors(profile);

  const data: MorningstarData = {
    fundName,
    morningstarUrl,
    equityPercent: profile.equityPercent,
    debtPercent: profile.debtPercent,
    cashPercent: profile.cashPercent,
    otherPercent: 0,
    sectors,
    isEstimated: true,
  };

  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}
