import { Router, type IRouter } from "express";
import { getMorningstarData, type SectorAllocation } from "../lib/morningstarScraper";
import { getGrowwData, type MarketCapAllocation } from "../lib/growwScraper";
import { AnalyzePortfolioBody } from "@workspace/api-zod";

const router: IRouter = Router();

function weightedAvgSectors(
  funds: Array<{ sipPercent: number; sectors: SectorAllocation | null }>
): SectorAllocation {
  const keys: (keyof SectorAllocation)[] = [
    "cyclical", "sensitive", "defensive",
    "financialServices", "realEstate", "consumerCyclical", "basicMaterials",
    "communicationServices", "energy", "industrials", "technology",
    "consumerDefensive", "healthcare", "utilities",
  ];

  const totalWeight = funds
    .filter((f) => f.sectors != null)
    .reduce((sum, f) => sum + f.sipPercent, 0);

  const result = {} as SectorAllocation;
  for (const key of keys) {
    if (totalWeight === 0) {
      result[key] = 0;
      continue;
    }
    result[key] = funds
      .filter((f) => f.sectors != null)
      .reduce((sum, f) => sum + (f.sectors![key] * f.sipPercent) / totalWeight, 0);
  }
  return result;
}

function weightedAvgMarketCap(
  funds: Array<{ sipPercent: number; marketCap: MarketCapAllocation | null }>
): { largeCap: number; midCap: number; smallCap: number; others: number } {
  const totalWeight = funds
    .filter((f) => f.marketCap != null)
    .reduce((sum, f) => sum + f.sipPercent, 0);

  if (totalWeight === 0) {
    return { largeCap: 0, midCap: 0, smallCap: 0, others: 0 };
  }

  return {
    largeCap: funds
      .filter((f) => f.marketCap != null)
      .reduce((sum, f) => sum + (f.marketCap!.largeCap * f.sipPercent) / totalWeight, 0),
    midCap: funds
      .filter((f) => f.marketCap != null)
      .reduce((sum, f) => sum + (f.marketCap!.midCap * f.sipPercent) / totalWeight, 0),
    smallCap: funds
      .filter((f) => f.marketCap != null)
      .reduce((sum, f) => sum + (f.marketCap!.smallCap * f.sipPercent) / totalWeight, 0),
    others: funds
      .filter((f) => f.marketCap != null)
      .reduce((sum, f) => sum + (f.marketCap!.others * f.sipPercent) / totalWeight, 0),
  };
}

// POST /portfolio/analyze
router.post("/portfolio/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { funds } = parsed.data;

  // Validate each fund's sipPercent is within [0, 100]
  for (const fund of funds) {
    if (!Number.isFinite(fund.sipPercent) || fund.sipPercent < 0 || fund.sipPercent > 100) {
      res.status(400).json({
        error: `Invalid sipPercent for "${fund.fundName}": must be between 0 and 100`,
      });
      return;
    }
  }

  // Validate SIP % sums to ~100 (within 0.5% tolerance)
  const totalSip = funds.reduce((sum, f) => sum + f.sipPercent, 0);
  if (Math.abs(totalSip - 100) > 0.5) {
    res.status(400).json({
      error: `SIP percentages must sum to 100 (got ${totalSip.toFixed(2)})`,
    });
    return;
  }

  req.log.info({ fundCount: funds.length }, "Analyzing portfolio");

  // Fetch all data concurrently
  const results = await Promise.allSettled(
    funds.map(async (fund) => {
      const [morningstarResult, growwResult] = await Promise.allSettled([
        getMorningstarData(fund.fundName),
        getGrowwData(fund.fundName),
      ]);

      return {
        fundName: fund.fundName,
        sipPercent: fund.sipPercent,
        morningstar:
          morningstarResult.status === "fulfilled"
            ? morningstarResult.value
            : null,
        morningstarError:
          morningstarResult.status === "rejected"
            ? String(morningstarResult.reason)
            : null,
        groww:
          growwResult.status === "fulfilled" ? growwResult.value : null,
        growwError:
          growwResult.status === "rejected"
            ? String(growwResult.reason)
            : null,
      };
    })
  );

  const fundAnalyses = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      fundName: funds[i].fundName,
      sipPercent: funds[i].sipPercent,
      morningstar: null,
      morningstarError: String(r.reason),
      groww: null,
      growwError: String(r.reason),
    };
  });

  // Compute aggregated weighted averages
  const forSectors = fundAnalyses.map((f) => ({
    sipPercent: f.sipPercent,
    sectors: f.morningstar?.sectors ?? null,
  }));
  const forMarketCap = fundAnalyses.map((f) => ({
    sipPercent: f.sipPercent,
    marketCap: f.groww?.marketCap ?? null,
  }));

  // Aggregation for equity/debt/cash
  const allWithMS = fundAnalyses.filter((f) => f.morningstar != null);
  const msTotalWeight = allWithMS.reduce((s, f) => s + f.sipPercent, 0);
  const aggregatedEquity = msTotalWeight > 0
    ? allWithMS.reduce((s, f) => s + (f.morningstar!.equityPercent * f.sipPercent) / msTotalWeight, 0)
    : 0;
  const aggregatedDebt = msTotalWeight > 0
    ? allWithMS.reduce((s, f) => s + (f.morningstar!.debtPercent * f.sipPercent) / msTotalWeight, 0)
    : 0;
  const aggregatedCash = msTotalWeight > 0
    ? allWithMS.reduce((s, f) => s + (f.morningstar!.cashPercent * f.sipPercent) / msTotalWeight, 0)
    : 0;
  const aggregatedOther = msTotalWeight > 0
    ? allWithMS.reduce((s, f) => s + (f.morningstar!.otherPercent * f.sipPercent) / msTotalWeight, 0)
    : 0;

  const aggregated = {
    equityPercent: aggregatedEquity,
    debtPercent: aggregatedDebt,
    cashPercent: aggregatedCash,
    otherPercent: aggregatedOther,
    sectors: weightedAvgSectors(forSectors),
    marketCap: weightedAvgMarketCap(forMarketCap),
  };

  res.json({ funds: fundAnalyses, aggregated });
});

export default router;
