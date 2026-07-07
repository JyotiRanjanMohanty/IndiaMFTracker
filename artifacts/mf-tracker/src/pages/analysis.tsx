import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, RefreshCw, Loader2, Info } from "lucide-react";
import { Redirect } from "wouter";
import { useAppStore } from "@/lib/store";
import {
  useGetFundMorningstarData,
  useGetFundGrowwData,
  getGetFundMorningstarDataQueryKey,
  getGetFundGrowwDataQueryKey
} from "@workspace/api-client-react";
import { useState } from "react";
import type { FundAnalysis } from "@workspace/api-client-react";

// ── Color palettes ────────────────────────────────────────────────────────────

const CYCLICAL_COLOR   = "hsl(222,60%,22%)";
const SENSITIVE_COLOR  = "hsl(35,90%,48%)";
const DEFENSIVE_COLOR  = "hsl(145,50%,36%)";

const SECTOR_CONFIG = {
  // Cyclical — navy shades
  financialServices:    { label: "Financial Services",   color: "hsl(222,60%,22%)", group: "cyclical" },
  consumerCyclical:     { label: "Consumer Cyclical",    color: "hsl(222,52%,36%)", group: "cyclical" },
  basicMaterials:       { label: "Basic Materials",      color: "hsl(222,44%,50%)", group: "cyclical" },
  realEstate:           { label: "Real Estate",          color: "hsl(222,36%,64%)", group: "cyclical" },
  // Sensitive — amber shades
  technology:           { label: "Technology",           color: "hsl(35,90%,38%)",  group: "sensitive" },
  industrials:          { label: "Industrials",          color: "hsl(35,85%,50%)",  group: "sensitive" },
  energy:               { label: "Energy",               color: "hsl(35,80%,61%)",  group: "sensitive" },
  communicationServices:{ label: "Communication Svcs",   color: "hsl(35,75%,72%)",  group: "sensitive" },
  // Defensive — green shades
  healthcare:           { label: "Healthcare",           color: "hsl(145,50%,30%)", group: "defensive" },
  consumerDefensive:    { label: "Consumer Defensive",   color: "hsl(145,45%,43%)", group: "defensive" },
  utilities:            { label: "Utilities",            color: "hsl(145,40%,56%)", group: "defensive" },
} as const;

type SubsectorKey = keyof typeof SECTOR_CONFIG;
const SUBSECTOR_KEYS = Object.keys(SECTOR_CONFIG) as SubsectorKey[];

// ── FundCard ──────────────────────────────────────────────────────────────────

function FundCard({ fund: initialFund }: { fund: FundAnalysis }) {
  const [fund, setFund] = useState<FundAnalysis>(initialFund);

  const { refetch: retryMorningstar, isFetching: isMorningstarFetching } = useGetFundMorningstarData(
    { fundName: fund.fundName },
    { query: { enabled: false, queryKey: getGetFundMorningstarDataQueryKey({ fundName: fund.fundName }) } }
  );

  const { refetch: retryGroww, isFetching: isGrowwFetching } = useGetFundGrowwData(
    { fundName: fund.fundName },
    { query: { enabled: false, queryKey: getGetFundGrowwDataQueryKey({ fundName: fund.fundName }) } }
  );

  const handleRetryMorningstar = async () => {
    try {
      const result = await retryMorningstar();
      if (result.data) setFund(prev => ({ ...prev, morningstar: result.data as any, morningstarError: null }));
      else if (result.error) setFund(prev => ({ ...prev, morningstarError: (result.error as any)?.error ?? "Retry failed" }));
    } catch (e) { console.error(e); }
  };

  const handleRetryGroww = async () => {
    try {
      const result = await retryGroww();
      if (result.data) setFund(prev => ({ ...prev, groww: result.data as any, growwError: null }));
      else if (result.error) setFund(prev => ({ ...prev, growwError: (result.error as any)?.error ?? "Retry failed" }));
    } catch (e) { console.error(e); }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/10 py-3 border-b flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1 pr-4">
          <CardTitle className="text-base leading-snug">{fund.fundName}</CardTitle>
          <CardDescription className="font-mono text-xs text-primary font-medium">SIP Weight: {fund.sipPercent}%</CardDescription>
        </div>
        {fund.morningstar?.morningstarUrl && (
          <a href={fund.morningstar.morningstarUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
            Morningstar ↗
          </a>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-4">

        {(fund.morningstarError || fund.growwError) && (
          <div className="flex flex-col gap-2 bg-destructive/10 text-destructive p-3 rounded-md text-sm border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="font-semibold block">Data partial or missing</span>
                <div className="opacity-90 text-xs mt-1 space-y-1">
                  {fund.morningstarError && (
                    <div className="flex items-center justify-between gap-2">
                      <span>Sector data: {fund.morningstarError}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6 shrink-0 bg-transparent border-destructive/30 hover:bg-destructive/20 text-destructive"
                        onClick={handleRetryMorningstar} disabled={isMorningstarFetching} title="Retry">
                        {isMorningstarFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    </div>
                  )}
                  {fund.growwError && (
                    <div className="flex items-center justify-between gap-2">
                      <span>Market cap: {fund.growwError}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6 shrink-0 bg-transparent border-destructive/30 hover:bg-destructive/20 text-destructive"
                        onClick={handleRetryGroww} disabled={isGrowwFetching} title="Retry">
                        {isGrowwFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {fund.morningstar && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Asset Split {fund.morningstar.isEstimated && <span className="normal-case text-amber-600 font-normal">(est.)</span>}</span>
              <span className="font-mono">{fund.morningstar.equityPercent.toFixed(1)}% Equity</span>
            </div>
            <div className="flex h-3 w-full rounded-sm overflow-hidden bg-muted">
              {fund.morningstar.equityPercent > 0 && <div style={{ width: `${fund.morningstar.equityPercent}%`, backgroundColor: 'var(--color-chart-1)' }} title={`Equity: ${fund.morningstar.equityPercent}%`} />}
              {fund.morningstar.debtPercent > 0 && <div style={{ width: `${fund.morningstar.debtPercent}%`, backgroundColor: 'var(--color-chart-2)' }} title={`Debt: ${fund.morningstar.debtPercent}%`} />}
              {fund.morningstar.cashPercent > 0 && <div style={{ width: `${fund.morningstar.cashPercent}%`, backgroundColor: 'var(--color-chart-3)' }} title={`Cash: ${fund.morningstar.cashPercent}%`} />}
              {(fund.morningstar.otherPercent ?? 0) > 0 && <div style={{ width: `${fund.morningstar.otherPercent}%`, backgroundColor: 'var(--color-chart-4)' }} title={`Other: ${fund.morningstar.otherPercent}%`} />}
            </div>
            <div className="flex gap-4 text-[10px] font-mono text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-chart-1)]"></span>Equity</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-chart-2)]"></span>Debt</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-chart-3)]"></span>Cash</span>
            </div>
          </div>
        )}

        {fund.groww && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Market Cap {fund.groww.isEstimated && <span className="normal-case text-amber-600 font-normal">(est.)</span>}</span>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="font-mono bg-[var(--color-chart-1)] text-white hover:bg-[var(--color-chart-1)]">L: {fund.groww.marketCap.largeCap.toFixed(0)}%</Badge>
              <Badge variant="secondary" className="font-mono bg-[var(--color-chart-2)] text-white hover:bg-[var(--color-chart-2)]">M: {fund.groww.marketCap.midCap.toFixed(0)}%</Badge>
              <Badge variant="secondary" className="font-mono bg-[var(--color-chart-3)] text-white hover:bg-[var(--color-chart-3)]">S: {fund.groww.marketCap.smallCap.toFixed(0)}%</Badge>
              {(fund.groww.marketCap.others ?? 0) > 0 && (
                <Badge variant="secondary" className="font-mono bg-[var(--color-chart-4)] text-white hover:bg-[var(--color-chart-4)]">O: {(fund.groww.marketCap.others ?? 0).toFixed(0)}%</Badge>
              )}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

// ── SubsectorRow ──────────────────────────────────────────────────────────────

function SubsectorRow({ label, value, color, maxValue }: { label: string; value: number; color: string; maxValue: number }) {
  const barWidth = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="grid grid-cols-[1fr_auto_100px] items-center gap-3 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-xs font-mono tabular-nums w-12 text-right">{value.toFixed(1)}%</span>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barWidth}%`, background: color }} />
      </div>
    </div>
  );
}

// ── SuperSectorGroup ──────────────────────────────────────────────────────────

function SuperSectorGroup({
  title, totalValue, color, subsectors
}: {
  title: string;
  totalValue: number;
  color: string;
  subsectors: Array<{ key: SubsectorKey; value: number }>;
}) {
  const maxValue = Math.max(...subsectors.map(s => s.value), 1);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{title}</span>
        </div>
        <span className="text-sm font-mono font-semibold tabular-nums">{totalValue.toFixed(1)}%</span>
      </div>
      {subsectors.map(({ key, value }) => (
        <SubsectorRow
          key={key}
          label={SECTOR_CONFIG[key].label}
          value={value}
          color={SECTOR_CONFIG[key].color}
          maxValue={maxValue}
        />
      ))}
    </div>
  );
}

// ── Main Analysis Page ────────────────────────────────────────────────────────

export default function Analysis() {
  const { analysis } = useAppStore();

  if (!analysis) return <Redirect to="/" />;

  const { aggregated, funds } = analysis;
  const hasEstimatedData = funds.some(f => f.morningstar?.isEstimated || f.groww?.isEstimated);

  // Asset class pie
  const assetClassData = [
    { name: "Equity", value: aggregated.equityPercent, fill: "var(--color-chart-1)" },
    { name: "Debt",   value: aggregated.debtPercent,   fill: "var(--color-chart-2)" },
    { name: "Cash",   value: aggregated.cashPercent,   fill: "var(--color-chart-3)" },
    { name: "Other",  value: aggregated.otherPercent,  fill: "var(--color-chart-4)" },
  ].filter(d => d.value > 0);

  // Sector dual-ring
  const superSectorData = [
    { name: "Cyclical",  value: aggregated.sectors.cyclical,  fill: CYCLICAL_COLOR },
    { name: "Sensitive", value: aggregated.sectors.sensitive, fill: SENSITIVE_COLOR },
    { name: "Defensive", value: aggregated.sectors.defensive, fill: DEFENSIVE_COLOR },
  ].filter(d => d.value > 0);

  const subsectorData = SUBSECTOR_KEYS.map(key => ({
    name: SECTOR_CONFIG[key].label,
    value: aggregated.sectors[key],
    fill: SECTOR_CONFIG[key].color,
  })).filter(d => d.value > 0);

  // Market cap pie
  const mcapData = [
    { name: "Large Cap", value: aggregated.marketCap.largeCap, fill: "var(--color-chart-1)" },
    { name: "Mid Cap",   value: aggregated.marketCap.midCap,   fill: "var(--color-chart-2)" },
    { name: "Small Cap", value: aggregated.marketCap.smallCap, fill: "var(--color-chart-3)" },
    { name: "Others",    value: aggregated.marketCap.others,   fill: "var(--color-chart-4)" },
  ].filter(d => d.value > 0);

  const formatPct = (val: number) => `${val.toFixed(2)}%`;

  // Subsector groups for breakdown table
  const cyclicalSubs: Array<{ key: SubsectorKey; value: number }> = [
    { key: "financialServices",  value: aggregated.sectors.financialServices },
    { key: "consumerCyclical",   value: aggregated.sectors.consumerCyclical },
    { key: "basicMaterials",     value: aggregated.sectors.basicMaterials },
    { key: "realEstate",         value: aggregated.sectors.realEstate },
  ];
  const sensitiveSubs: Array<{ key: SubsectorKey; value: number }> = [
    { key: "technology",            value: aggregated.sectors.technology },
    { key: "industrials",           value: aggregated.sectors.industrials },
    { key: "energy",                value: aggregated.sectors.energy },
    { key: "communicationServices", value: aggregated.sectors.communicationServices },
  ];
  const defensiveSubs: Array<{ key: SubsectorKey; value: number }> = [
    { key: "healthcare",        value: aggregated.sectors.healthcare },
    { key: "consumerDefensive", value: aggregated.sectors.consumerDefensive },
    { key: "utilities",         value: aggregated.sectors.utilities },
  ];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Analysis</h1>
          <p className="text-muted-foreground mt-1">Consolidated view across {funds.length} fund{funds.length > 1 ? "s" : ""}.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-mono text-muted-foreground uppercase mb-1">Total Equity Exposure</span>
          <span className="text-3xl font-bold font-mono text-primary">{aggregated.equityPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Estimated data notice */}
      {hasEstimatedData && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold">Category-estimated data </span>
            — Sector and market cap figures are derived from each fund's SEBI category (e.g. "Equity Scheme – Flexi Cap Fund") 
            using SEBI-mandated allocation ranges. Values are typical for the category, not fund-specific real-time data.
            Fields labelled <span className="font-semibold">(est.)</span> reflect this.
          </div>
        </div>
      )}

      {/* Top row: Asset Allocation + Market Cap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Asset Allocation */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <CardDescription>Equity · Debt · Cash breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={assetClassData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={2} dataKey="value">
                  {assetClassData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={formatPct} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs font-mono text-muted-foreground">
              {assetClassData.map(d => (
                <span key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                  {d.name} {d.value.toFixed(1)}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Capitalisation */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Market Capitalisation</CardTitle>
            <CardDescription>Large · Mid · Small cap size bias</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mcapData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={2} dataKey="value">
                  {mcapData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={formatPct} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs font-mono text-muted-foreground">
              {mcapData.map(d => (
                <span key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                  {d.name} {d.value.toFixed(1)}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Sector Allocation — full width */}
      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-xl">Sector Allocation</CardTitle>
          <CardDescription>
            Three super-sectors (Cyclical · Sensitive · Defensive) broken into 11 subsectors — as % of total portfolio
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

            {/* Left — dual-ring pie chart */}
            <div>
              <p className="text-xs text-muted-foreground text-center mb-2 font-mono uppercase tracking-wide">
                Centre: super-sectors &nbsp;·&nbsp; Ring: subsectors
              </p>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {/* Centre disc — super sectors */}
                    <Pie
                      data={superSectorData}
                      cx="50%" cy="50%"
                      innerRadius={0} outerRadius={70}
                      dataKey="value"
                      stroke="none"
                    >
                      {superSectorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    {/* Outer ring — subsectors */}
                    <Pie
                      data={subsectorData}
                      cx="50%" cy="50%"
                      innerRadius={76} outerRadius={120}
                      dataKey="value"
                      stroke="white"
                      strokeWidth={1.5}
                    >
                      {subsectorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={formatPct} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Super-sector legend under chart */}
              <div className="flex justify-center gap-6 mt-2 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: CYCLICAL_COLOR }} /> Cyclical {aggregated.sectors.cyclical.toFixed(1)}%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: SENSITIVE_COLOR }} /> Sensitive {aggregated.sectors.sensitive.toFixed(1)}%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: DEFENSIVE_COLOR }} /> Defensive {aggregated.sectors.defensive.toFixed(1)}%</span>
              </div>
            </div>

            {/* Right — subsector breakdown */}
            <div className="space-y-6 pt-2">
              <SuperSectorGroup
                title="Cyclical"
                totalValue={aggregated.sectors.cyclical}
                color={CYCLICAL_COLOR}
                subsectors={cyclicalSubs}
              />
              <div className="border-t" />
              <SuperSectorGroup
                title="Sensitive"
                totalValue={aggregated.sectors.sensitive}
                color={SENSITIVE_COLOR}
                subsectors={sensitiveSubs}
              />
              <div className="border-t" />
              <SuperSectorGroup
                title="Defensive"
                totalValue={aggregated.sectors.defensive}
                color={DEFENSIVE_COLOR}
                subsectors={defensiveSubs}
              />
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Individual fund cards */}
      <div className="pt-4 border-t space-y-6">
        <h2 className="text-2xl font-bold">Individual Fund Contributions</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {funds.map((fund, idx) => (
            <FundCard key={idx} fund={fund} />
          ))}
        </div>
      </div>

    </div>
  );
}
