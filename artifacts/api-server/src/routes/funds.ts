import { Router, type IRouter } from "express";
import { searchFunds } from "../lib/fundSearch";
import { getMorningstarData } from "../lib/morningstarScraper";
import { getGrowwData } from "../lib/growwScraper";
import {
  SearchFundsQueryParams,
  GetFundMorningstarDataQueryParams,
  GetFundGrowwDataQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /funds/search?q=...
router.get("/funds/search", async (req, res): Promise<void> => {
  const parsed = SearchFundsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const results = await searchFunds(parsed.data.q);
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Fund search error");
    res.status(500).json({ error: "Failed to search funds" });
  }
});

// GET /funds/morningstar?fundName=...
router.get("/funds/morningstar", async (req, res): Promise<void> => {
  const parsed = GetFundMorningstarDataQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const data = await getMorningstarData(parsed.data.fundName);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Morningstar scrape error");
    res.status(500).json({ error: `Failed to fetch Morningstar data: ${String(err)}` });
  }
});

// GET /funds/groww?fundName=...
router.get("/funds/groww", async (req, res): Promise<void> => {
  const parsed = GetFundGrowwDataQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const data = await getGrowwData(parsed.data.fundName);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Groww scrape error");
    res.status(500).json({ error: `Failed to fetch Groww data: ${String(err)}` });
  }
});

export default router;
