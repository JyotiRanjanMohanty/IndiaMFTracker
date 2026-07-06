import axios from "axios";
import { logger } from "./logger";

export interface FundEntry {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
}

let cachedFunds: FundEntry[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function extractFundHouse(schemeName: string): string {
  const knownHouses = [
    "Aditya Birla Sun Life",
    "Axis",
    "Bandhan",
    "Bank of India",
    "Baroda BNP Paribas",
    "Canara Robeco",
    "DSP",
    "Edelweiss",
    "Franklin Templeton",
    "HDFC",
    "HSBC",
    "ICICI Prudential",
    "IDBI",
    "IDFC",
    "IL&FS",
    "Invesco India",
    "ITI",
    "JM Financial",
    "Kotak",
    "L&T",
    "LIC",
    "Mahindra Manulife",
    "Mirae Asset",
    "Motilal Oswal",
    "Navi",
    "Nippon India",
    "NJ",
    "PGIM India",
    "PPFAS",
    "Parag Parikh",
    "Quant",
    "Quantum",
    "SBI",
    "Samco",
    "Shriram",
    "Sundaram",
    "Tata",
    "Taurus",
    "Trust",
    "UTI",
    "Union",
    "WhiteOak Capital",
    "Zerodha",
  ];
  for (const house of knownHouses) {
    if (schemeName.toLowerCase().includes(house.toLowerCase())) {
      return house;
    }
  }
  // Fallback: take first 2 words
  return schemeName.split(" ").slice(0, 2).join(" ");
}

function extractCategory(schemeName: string): string {
  const lower = schemeName.toLowerCase();
  if (lower.includes("liquid")) return "Liquid";
  if (lower.includes("overnight")) return "Overnight";
  if (lower.includes("ultra short")) return "Ultra Short Duration";
  if (lower.includes("low duration")) return "Low Duration";
  if (lower.includes("short duration") || lower.includes("short term")) return "Short Duration";
  if (lower.includes("medium duration")) return "Medium Duration";
  if (lower.includes("long duration") || lower.includes("long term")) return "Long Duration";
  if (lower.includes("dynamic bond") || lower.includes("dynamic debt")) return "Dynamic Bond";
  if (lower.includes("credit risk")) return "Credit Risk";
  if (lower.includes("gilt")) return "Gilt";
  if (lower.includes("floating rate")) return "Floating Rate";
  if (lower.includes("corporate bond")) return "Corporate Bond";
  if (lower.includes("banking and psu") || lower.includes("banking & psu")) return "Banking & PSU";
  if (lower.includes("flexi cap") || lower.includes("flexicap")) return "Flexi Cap";
  if (lower.includes("multi cap") || lower.includes("multicap")) return "Multi Cap";
  if (lower.includes("large and mid") || lower.includes("large & mid")) return "Large & Mid Cap";
  if (lower.includes("large cap")) return "Large Cap";
  if (lower.includes("mid cap")) return "Mid Cap";
  if (lower.includes("small cap")) return "Small Cap";
  if (lower.includes("micro cap")) return "Micro Cap";
  if (lower.includes("value fund") || lower.includes("value ")) return "Value";
  if (lower.includes("contra")) return "Contra";
  if (lower.includes("focused")) return "Focused";
  if (lower.includes("elss") || lower.includes("tax saver") || lower.includes("tax saving")) return "ELSS";
  if (lower.includes("dividend yield")) return "Dividend Yield";
  if (lower.includes("sectoral") || lower.includes("sector")) return "Sectoral/Thematic";
  if (lower.includes("thematic")) return "Sectoral/Thematic";
  if (lower.includes("infrastructure") || lower.includes("infra")) return "Infrastructure";
  if (lower.includes("technology") || lower.includes("tech")) return "Technology";
  if (lower.includes("banking")) return "Banking";
  if (lower.includes("healthcare") || lower.includes("pharma")) return "Healthcare/Pharma";
  if (lower.includes("international") || lower.includes("global") || lower.includes("overseas") || lower.includes("world") || lower.includes("us ") || lower.includes("nasdaq") || lower.includes("hang seng")) return "International";
  if (lower.includes("hybrid") || lower.includes("balanced advantage") || lower.includes("aggressive hybrid") || lower.includes("conservative hybrid")) return "Hybrid";
  if (lower.includes("arbitrage")) return "Arbitrage";
  if (lower.includes("equity savings")) return "Equity Savings";
  if (lower.includes("fund of fund") || lower.includes("fof")) return "Fund of Funds";
  if (lower.includes("index") || lower.includes("nifty") || lower.includes("sensex") || lower.includes("bse")) return "Index";
  if (lower.includes("etf")) return "ETF";
  if (lower.includes("gold")) return "Gold";
  if (lower.includes("silver")) return "Silver";
  return "Equity";
}

async function loadFunds(): Promise<FundEntry[]> {
  const now = Date.now();
  if (cachedFunds && now - cacheTime < CACHE_TTL_MS) {
    return cachedFunds;
  }

  logger.info("Fetching AMFI fund list from mfapi.in");
  const resp = await axios.get<Array<{ schemeCode: number; schemeName: string }>>(
    "https://api.mfapi.in/mf",
    { timeout: 15000 }
  );

  const funds: FundEntry[] = resp.data.map((entry) => ({
    schemeCode: String(entry.schemeCode),
    schemeName: entry.schemeName,
    fundHouse: extractFundHouse(entry.schemeName),
    category: extractCategory(entry.schemeName),
  }));

  cachedFunds = funds;
  cacheTime = now;
  logger.info({ count: funds.length }, "Loaded fund list");
  return funds;
}

export async function searchFunds(query: string): Promise<FundEntry[]> {
  if (!query || query.trim().length < 2) return [];
  const funds = await loadFunds();
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/);

  const scored = funds
    .map((f) => {
      const name = f.schemeName.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (name.includes(token)) score += token.length;
      }
      if (name.startsWith(q)) score += 20;
      return { fund: f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 15).map((x) => x.fund);
}
