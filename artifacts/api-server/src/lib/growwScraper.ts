import axios from "axios";
import * as cheerio from "cheerio";
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
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

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

const MIN_NAME_SIMILARITY = 0.25;

function toGrowwSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .trim();
}

async function searchGroww(fundName: string): Promise<string | null> {
  // Try Groww search API
  try {
    const query = encodeURIComponent(fundName.slice(0, 50));
    const searchUrl = `https://groww.in/v1/api/search/v4/query?query=${query}&page=0&size=5&type=MUTUAL_FUND`;
    const resp = await axios.get<{
      data?: {
        content?: Array<{ search_id?: string; params?: { legal_name?: string; slug?: string } }>;
      };
    }>(searchUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "application/json",
        Referer: "https://groww.in/",
      },
      timeout: 10000,
    });

    const content = resp.data?.data?.content;
    if (content && content.length > 0) {
      const first = content[0];
      const resultName = first.params?.legal_name || "";
      // Verify the result is actually the fund we want
      if (resultName && nameSimilarity(fundName, resultName) < MIN_NAME_SIMILARITY) {
        logger.warn({ fundName, resultName }, "Groww search result name mismatch — skipping");
      } else {
        const slug = first.params?.slug || first.search_id;
        if (slug) {
          return `https://groww.in/mutual-funds/${slug}?holdingAnalysis=true`;
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "Groww search API failed, trying alternate");
  }

  // Fallback: try to construct the URL from the name
  try {
    const slug = toGrowwSlug(fundName);
    const candidateUrl = `https://groww.in/mutual-funds/${slug}?holdingAnalysis=true`;
    // Validate that it returns 200
    await axios.get(candidateUrl, {
      headers: BROWSER_HEADERS,
      timeout: 10000,
      validateStatus: (s) => s < 400,
    });
    return candidateUrl;
  } catch {
    // URL construction failed
  }

  return null;
}

function parsePercent(text: string): number {
  const match = text.replace(/,/g, "").match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

async function scrapeGrowwPage(url: string): Promise<Partial<GrowwData>> {
  const resp = await axios.get(url, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: "https://groww.in/mutual-funds",
    },
    timeout: 20000,
  });

  const html = resp.data as string;
  const $ = cheerio.load(html);

  const marketCap: MarketCapAllocation = {
    largeCap: 0,
    midCap: 0,
    smallCap: 0,
    others: 0,
  };

  // Try to find market cap data in the page
  // Groww renders market cap in a section with labels like "Large Cap", "Mid Cap", "Small Cap"
  let found = false;

  // Method 1: Look for JSON data embedded in next.js __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Navigate through the nested structure to find market cap data
      const jsonStr = JSON.stringify(nextData);
      
      // Look for market cap patterns in the JSON
      const largeCapMatch = jsonStr.match(/"large_cap[_\s]?%?"\s*:\s*([\d.]+)/i) ||
                             jsonStr.match(/"largeCap"\s*:\s*([\d.]+)/i) ||
                             jsonStr.match(/"large"\s*:\s*([\d.]+)/i);
      const midCapMatch = jsonStr.match(/"mid_cap[_\s]?%?"\s*:\s*([\d.]+)/i) ||
                           jsonStr.match(/"midCap"\s*:\s*([\d.]+)/i) ||
                           jsonStr.match(/"mid"\s*:\s*([\d.]+)/i);
      const smallCapMatch = jsonStr.match(/"small_cap[_\s]?%?"\s*:\s*([\d.]+)/i) ||
                             jsonStr.match(/"smallCap"\s*:\s*([\d.]+)/i) ||
                             jsonStr.match(/"small"\s*:\s*([\d.]+)/i);

      if (largeCapMatch || midCapMatch || smallCapMatch) {
        marketCap.largeCap = largeCapMatch ? parseFloat(largeCapMatch[1]) : 0;
        marketCap.midCap = midCapMatch ? parseFloat(midCapMatch[1]) : 0;
        marketCap.smallCap = smallCapMatch ? parseFloat(smallCapMatch[1]) : 0;
        marketCap.others = Math.max(
          0,
          100 - marketCap.largeCap - marketCap.midCap - marketCap.smallCap
        );
        found = true;
      }
    } catch {
      // JSON parse failed
    }
  }

  // Method 2: Look for Groww API data embedded in window.__DATA__
  if (!found) {
    const windowDataMatch = html.match(/window\.__DATA__\s*=\s*({[\s\S]*?});/);
    if (windowDataMatch) {
      try {
        const data = JSON.parse(windowDataMatch[1]);
        const jsonStr = JSON.stringify(data);
        const largeCapMatch = jsonStr.match(/"large_cap"\s*:\s*([\d.]+)/i);
        const midCapMatch = jsonStr.match(/"mid_cap"\s*:\s*([\d.]+)/i);
        const smallCapMatch = jsonStr.match(/"small_cap"\s*:\s*([\d.]+)/i);
        if (largeCapMatch || midCapMatch || smallCapMatch) {
          marketCap.largeCap = largeCapMatch ? parseFloat(largeCapMatch[1]) : 0;
          marketCap.midCap = midCapMatch ? parseFloat(midCapMatch[1]) : 0;
          marketCap.smallCap = smallCapMatch ? parseFloat(smallCapMatch[1]) : 0;
          marketCap.others = Math.max(
            0,
            100 - marketCap.largeCap - marketCap.midCap - marketCap.smallCap
          );
          found = true;
        }
      } catch {
        // JSON parse failed
      }
    }
  }

  // Method 3: Look through HTML tables and divs for "Large Cap", "Mid Cap", "Small Cap"
  if (!found) {
    const capMap: Record<string, keyof MarketCapAllocation> = {
      "large cap": "largeCap",
      "large-cap": "largeCap",
      largecap: "largeCap",
      "mid cap": "midCap",
      "mid-cap": "midCap",
      midcap: "midCap",
      "small cap": "smallCap",
      "small-cap": "smallCap",
      smallcap: "smallCap",
      others: "others",
      other: "others",
    };

    $("tr, .market-cap, [class*=marketCap], [class*=market_cap]").each((_i, el) => {
      const text = $(el).text().trim().toLowerCase();
      for (const [key, field] of Object.entries(capMap)) {
        if (text.includes(key)) {
          const nums = text.match(/([\d.]+)\s*%/g);
          if (nums && nums.length > 0) {
            marketCap[field] = parsePercent(nums[0]);
            found = true;
          }
        }
      }
    });
  }

  // Method 4: look for inline scripts with market cap data
  if (!found) {
    $("script").each((_i, el) => {
      const text = $(el).html() || "";
      if (text.toLowerCase().includes("large_cap") || text.toLowerCase().includes("largecap")) {
        const largeCapMatch = text.match(/"?large_?cap"?\s*[:=]\s*([\d.]+)/i);
        const midCapMatch = text.match(/"?mid_?cap"?\s*[:=]\s*([\d.]+)/i);
        const smallCapMatch = text.match(/"?small_?cap"?\s*[:=]\s*([\d.]+)/i);
        if (largeCapMatch || midCapMatch || smallCapMatch) {
          marketCap.largeCap = largeCapMatch ? parseFloat(largeCapMatch[1]) : 0;
          marketCap.midCap = midCapMatch ? parseFloat(midCapMatch[1]) : 0;
          marketCap.smallCap = smallCapMatch ? parseFloat(smallCapMatch[1]) : 0;
          marketCap.others = Math.max(
            0,
            100 - marketCap.largeCap - marketCap.midCap - marketCap.smallCap
          );
          found = true;
        }
      }
    });
  }

  return { marketCap };
}

// In-memory cache
const cache = new Map<string, { data: GrowwData; ts: number }>();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export async function getGrowwData(fundName: string): Promise<GrowwData> {
  const cached = cache.get(fundName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  logger.info({ fundName }, "Fetching Groww data");

  const growwUrl = await searchGroww(fundName);
  logger.info({ fundName, growwUrl }, "Groww URL found");

  const partial = growwUrl ? await scrapeGrowwPage(growwUrl) : {};

  const defaultCap: MarketCapAllocation = { largeCap: 0, midCap: 0, smallCap: 0, others: 0 };

  const data: GrowwData = {
    fundName,
    growwUrl,
    marketCap: partial.marketCap ?? defaultCap,
  };

  cache.set(fundName, { data, ts: Date.now() });
  return data;
}
