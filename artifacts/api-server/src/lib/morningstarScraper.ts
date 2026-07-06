import axios from "axios";
import * as cheerio from "cheerio";
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
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Cache-Control": "no-cache",
};

function slugify(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/** Simple token-overlap similarity between two fund names (0–1). */
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

const MIN_NAME_SIMILARITY = 0.25; // minimum overlap to trust a search result

async function searchMorningstar(fundName: string): Promise<string | null> {
  // Try Morningstar's quicksearch endpoint
  try {
    const query = encodeURIComponent(fundName.slice(0, 40));
    const searchUrl = `https://www.morningstar.in/handlers/QuickTakeHandler.ashx?languageId=en-IN&siteId=in&keyword=${query}&securityType=FO`;
    const resp = await axios.get(searchUrl, {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.morningstar.in/" },
      timeout: 10000,
    });

    const data = resp.data;
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const resultName = first.Name || first.FundName || "";
      if (resultName && nameSimilarity(fundName, resultName) < MIN_NAME_SIMILARITY) {
        logger.warn({ fundName, resultName }, "Morningstar quicksearch result name mismatch — skipping");
      } else if (first.SecId || first.Id || first.FundId) {
        const id = first.SecId || first.Id || first.FundId;
        const slug = resultName ? slugify(resultName) : slugify(fundName);
        return `https://www.morningstar.in/mutualfunds/${id.toLowerCase()}/${slug}/fund-factsheet.aspx`;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Morningstar quicksearch failed, trying alternate");
  }

  // Try autocomplete endpoint
  try {
    const query = encodeURIComponent(fundName.slice(0, 40));
    const autocompleteUrl = `https://www.morningstar.in/handlers/AutoCompleteHandler.ashx?query=${query}&securityType=FO&languageId=en-IN&siteId=in`;
    const resp = await axios.get(autocompleteUrl, {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.morningstar.in/" },
      timeout: 10000,
    });

    const text = resp.data as string;
    // Response format: "FundName|SecId|Category|FundHouse|..." separated by |
    const lines = String(text).split("\n").filter(Boolean);
    if (lines.length > 0) {
      const parts = lines[0].split("|");
      if (parts.length >= 2 && parts[1]) {
        const resultName = parts[0]?.trim() || "";
        if (resultName && nameSimilarity(fundName, resultName) < MIN_NAME_SIMILARITY) {
          logger.warn({ fundName, resultName }, "Morningstar autocomplete name mismatch — skipping");
          return null;
        }
        const secId = parts[1].trim().toLowerCase();
        const slug = slugify(resultName || fundName);
        return `https://www.morningstar.in/mutualfunds/${secId}/${slug}/fund-factsheet.aspx`;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Morningstar autocomplete failed");
  }

  return null;
}

function parsePercent(text: string): number {
  const match = text.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

async function scrapeFactsheet(factsheetUrl: string): Promise<Partial<MorningstarData>> {
  const resp = await axios.get(factsheetUrl, {
    headers: { ...BROWSER_HEADERS, Referer: "https://www.morningstar.in/" },
    timeout: 20000,
  });

  const $ = cheerio.load(resp.data as string);
  const result: Partial<MorningstarData> = {};

  // --- Asset Allocation: Equity / Debt / Cash ---
  // Look for asset allocation table
  $("table, .assetallocation, .asset-allocation").each((_i, el) => {
    const text = $(el).text();
    if (
      text.toLowerCase().includes("equity") &&
      text.toLowerCase().includes("debt")
    ) {
      $(el)
        .find("tr")
        .each((_j, row) => {
          const cells = $(row).find("td");
          const label = cells.eq(0).text().trim().toLowerCase();
          const val = parsePercent(cells.eq(1).text().trim());
          if (label.includes("equity") || label.includes("stocks")) {
            result.equityPercent = val;
          } else if (
            label.includes("bond") ||
            label.includes("debt") ||
            label.includes("fixed income")
          ) {
            result.debtPercent = val;
          } else if (label.includes("cash")) {
            result.cashPercent = val;
          } else if (label.includes("other")) {
            result.otherPercent = val;
          }
        });
    }
  });

  // --- Sector allocation ---
  const sectors: SectorAllocation = {
    cyclical: 0, sensitive: 0, defensive: 0,
    financialServices: 0, realEstate: 0, consumerCyclical: 0, basicMaterials: 0,
    communicationServices: 0, energy: 0, industrials: 0, technology: 0,
    consumerDefensive: 0, healthcare: 0, utilities: 0,
  };

  // Map Morningstar sector labels to our keys
  const sectorMap: Record<string, keyof SectorAllocation> = {
    "financial services": "financialServices",
    "financial service": "financialServices",
    "financialservices": "financialServices",
    "real estate": "realEstate",
    "realestate": "realEstate",
    "consumer cyclical": "consumerCyclical",
    "consumercyclical": "consumerCyclical",
    "basic materials": "basicMaterials",
    "basicmaterials": "basicMaterials",
    "communication services": "communicationServices",
    "communicationservices": "communicationServices",
    "energy": "energy",
    "industrials": "industrials",
    "technology": "technology",
    "consumer defensive": "consumerDefensive",
    "consumerdefensive": "consumerDefensive",
    "consumer staples": "consumerDefensive",
    "healthcare": "healthcare",
    "health care": "healthcare",
    "utilities": "utilities",
    "cyclical": "cyclical",
    "sensitive": "sensitive",
    "defensive": "defensive",
  };

  // Try to find sector table
  let sectorFound = false;
  $("table").each((_i, table) => {
    const tableText = $(table).text().toLowerCase();
    if (
      !tableText.includes("sector") &&
      !tableText.includes("financial") &&
      !tableText.includes("technology")
    ) {
      return;
    }

    $(table)
      .find("tr")
      .each((_j, row) => {
        const cells = $(row).find("td, th");
        if (cells.length < 2) return;
        const label = cells.eq(0).text().trim().toLowerCase();
        const valText = cells.eq(1).text().trim();

        for (const [key, fieldName] of Object.entries(sectorMap)) {
          if (label.includes(key)) {
            const val = parsePercent(valText);
            if (val > 0) {
              sectors[fieldName] = val;
              sectorFound = true;
            }
          }
        }
      });
  });

  // Also look in divs / spans with sector labels
  if (!sectorFound) {
    $("[class*='sector'], [id*='sector'], [class*='Sector']").each((_i, el) => {
      const text = $(el).text().toLowerCase();
      for (const [key, fieldName] of Object.entries(sectorMap)) {
        if (text.includes(key)) {
          const nums = text.match(/[\d.]+\s*%/g);
          if (nums && nums.length > 0) {
            sectors[fieldName] = parsePercent(nums[0]);
          }
        }
      }
    });
  }

  // Compute parent sectors from subsectors if missing
  if (sectors.cyclical === 0) {
    sectors.cyclical =
      sectors.financialServices +
      sectors.realEstate +
      sectors.consumerCyclical +
      sectors.basicMaterials;
  }
  if (sectors.sensitive === 0) {
    sectors.sensitive =
      sectors.communicationServices +
      sectors.energy +
      sectors.industrials +
      sectors.technology;
  }
  if (sectors.defensive === 0) {
    sectors.defensive =
      sectors.consumerDefensive + sectors.healthcare + sectors.utilities;
  }

  result.sectors = sectors;
  return result;
}

// In-memory cache per fund name
const cache = new Map<string, { data: MorningstarData; ts: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function getMorningstarData(fundName: string): Promise<MorningstarData> {
  const cached = cache.get(fundName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  logger.info({ fundName }, "Fetching Morningstar data");

  const factsheetUrl = await searchMorningstar(fundName);
  logger.info({ fundName, factsheetUrl }, "Morningstar URL found");

  const partial = factsheetUrl ? await scrapeFactsheet(factsheetUrl) : {};

  const defaultSectors: SectorAllocation = {
    cyclical: 0, sensitive: 0, defensive: 0,
    financialServices: 0, realEstate: 0, consumerCyclical: 0, basicMaterials: 0,
    communicationServices: 0, energy: 0, industrials: 0, technology: 0,
    consumerDefensive: 0, healthcare: 0, utilities: 0,
  };

  const data: MorningstarData = {
    fundName,
    morningstarUrl: factsheetUrl,
    equityPercent: partial.equityPercent ?? 0,
    debtPercent: partial.debtPercent ?? 0,
    cashPercent: partial.cashPercent ?? 0,
    otherPercent: partial.otherPercent ?? 0,
    sectors: partial.sectors ?? defaultSectors,
  };

  cache.set(fundName, { data, ts: Date.now() });
  return data;
}
