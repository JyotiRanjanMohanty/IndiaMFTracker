---
name: MF tracker data architecture
description: How sector allocation and market cap data is computed in the India MF Portfolio Tracker
---

## Architecture (as of July 2026)

Both `morningstarScraper.ts` and `growwScraper.ts` have been completely rewritten to use the following pipeline:

1. Call `mfapi.in/mf/search?q={fundName}` → get list of matching schemes
2. Apply token-overlap name-similarity guard (≥0.25) to reject wrong-fund matches
3. Prefer direct-plan growth option; fetch `mfapi.in/mf/{schemeCode}` → get `meta.scheme_category`
4. Map `scheme_category` string to an allocation profile using `profileFromCategory()` / `marketCapFromCategory()`
5. Return `isEstimated: true` so the frontend can show a disclosure notice

## Category profiles
- `BROAD_EQUITY` weights are Nifty-500 approximations (FinSvc 29%, Tech 17%, ConsumerCyc 9%, ...)
- Sectoral/thematic overrides: `BANKING_WEIGHTS`, `TECH_WEIGHTS`, `HEALTHCARE_WEIGHTS`, `INFRA_WEIGHTS`, `CONSUMER_WEIGHTS`
- SEBI market-cap mandate per category: Large Cap ≥80% top-100 stocks → modeled as ~82% large; Mid Cap ≥65% 101-250 → ~67% mid; etc.
- "Large & Mid Cap" must be checked BEFORE "large cap" and "mid cap" in the if-chain (more specific first)

## Caching
- Scheme category: 24-hour cache (`schemeMetaCache` / `schemeCategoryCache`) per fund name — categories are stable
- Final result: 6-hour cache (`cache`) per fund name
- Two separate caches per scraper (known duplication; acceptable for correctness)

## API contract
- `isEstimated: boolean` added to `MorningstarData` and `GrowwData` in OpenAPI spec and in `required` list
- `others: number` added to `MarketCapAllocation.required` list
- Regenerate client: `pnpm --filter @workspace/api-spec run codegen`
