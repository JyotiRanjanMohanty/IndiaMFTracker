---
name: Indian MF data sources
description: Which Indian MF data platforms are accessible via server-side HTTP and which are blocked
---

## What works (server-side Node.js)
- **mfapi.in** — `GET /mf/search?q=` and `GET /mf/{schemeCode}` — free, no auth, returns AMFI scheme metadata including `scheme_category`
- **Morningstar India `AutoCompleteHandler.ashx?criteria=`** — returns XML with fund ID (e.g. `F000016XMQ`) and name; useful for constructing fund-quote URLs only

## Blocked (confirmed July 2026)
- Morningstar India: all fund-detail pages, factsheet handlers, Umbraco AJAX endpoints → either empty body or redirect to NotWorking.aspx
- Groww: all search and fund-page APIs → 404
- Value Research Online: fund pages → 403
- Moneycontrol: autosuggest and fund pages → blocked/redirected
- NSE India API: "Resource not found"
- BSE India API: empty responses
- Kuvera API: returns `[]`
- Tickertape MF endpoints: "Invalid token" / 404
- lt.morningstar.com REST API: returns `[]`

**Why:** All these sites require JavaScript-rendered sessions or have actively blocked server-side HTTP access.

**Solution:** Use mfapi.in `scheme_category` field + SEBI-mandated category allocation model to compute sector and market cap allocation. Label results `isEstimated: true` and show a notice in the UI.
