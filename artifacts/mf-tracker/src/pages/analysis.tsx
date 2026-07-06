import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
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

function FundCard({ fund: initialFund }: { fund: FundAnalysis }) {
  const [fund, setFund] = useState<FundAnalysis>(initialFund);

  // We explicitly include the hooks to satisfy the requirement
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
      if (result.data) {
        setFund(prev => ({ ...prev, morningstar: result.data as any, morningstarError: null }));
      } else if (result.error) {
        const err = result.error as any;
        setFund(prev => ({ ...prev, morningstarError: err?.error || "Retry failed" }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetryGroww = async () => {
    try {
      const result = await retryGroww();
      if (result.data) {
        setFund(prev => ({ ...prev, groww: result.data as any, growwError: null }));
      } else if (result.error) {
        const err = result.error as any;
        setFund(prev => ({ ...prev, growwError: err?.error || "Retry failed" }));
      }
    } catch (e) {
      console.error(e);
    }
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
                      <span>Morningstar: {fund.morningstarError}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 shrink-0 bg-transparent border-destructive/30 hover:bg-destructive/20 text-destructive" 
                        onClick={handleRetryMorningstar}
                        disabled={isMorningstarFetching}
                        title="Retry Morningstar data"
                      >
                        {isMorningstarFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    </div>
                  )}
                  {fund.growwError && (
                    <div className="flex items-center justify-between gap-2">
                      <span>Groww: {fund.growwError}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-6 w-6 shrink-0 bg-transparent border-destructive/30 hover:bg-destructive/20 text-destructive" 
                        onClick={handleRetryGroww}
                        disabled={isGrowwFetching}
                        title="Retry Groww data"
                      >
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
              <span>Asset Split</span>
              <span className="font-mono">{fund.morningstar.equityPercent.toFixed(1)}% Eq</span>
            </div>
            <div className="flex h-3 w-full rounded-sm overflow-hidden bg-muted">
              {fund.morningstar.equityPercent > 0 && <div style={{ width: `${fund.morningstar.equityPercent}%`, backgroundColor: 'var(--color-chart-1)' }} title={`Equity: ${fund.morningstar.equityPercent}%`} />}
              {fund.morningstar.debtPercent > 0 && <div style={{ width: `${fund.morningstar.debtPercent}%`, backgroundColor: 'var(--color-chart-2)' }} title={`Debt: ${fund.morningstar.debtPercent}%`} />}
              {fund.morningstar.cashPercent > 0 && <div style={{ width: `${fund.morningstar.cashPercent}%`, backgroundColor: 'var(--color-chart-3)' }} title={`Cash: ${fund.morningstar.cashPercent}%`} />}
              {(fund.morningstar.otherPercent ?? 0) > 0 && <div style={{ width: `${fund.morningstar.otherPercent}%`, backgroundColor: 'var(--color-chart-4)' }} title={`Other: ${fund.morningstar.otherPercent}%`} />}
            </div>
            <div className="flex gap-4 text-[10px] font-mono text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-chart-1)]"></span>Eq</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-chart-2)]"></span>Debt</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-chart-3)]"></span>Cash</span>
            </div>
          </div>
        )}

        {fund.groww && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Market Cap</span>
              {fund.groww.growwUrl && (
                <a href={fund.groww.growwUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline capitalize">
                  Groww ↗
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="font-mono bg-[var(--color-chart-1)] text-white hover:bg-[var(--color-chart-1)]">L: {fund.groww.marketCap.largeCap.toFixed(0)}%</Badge>
              <Badge variant="secondary" className="font-mono bg-[var(--color-chart-2)] text-white hover:bg-[var(--color-chart-2)]">M: {fund.groww.marketCap.midCap.toFixed(0)}%</Badge>
              <Badge variant="secondary" className="font-mono bg-[var(--color-chart-3)] text-white hover:bg-[var(--color-chart-3)]">S: {fund.groww.marketCap.smallCap.toFixed(0)}%</Badge>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

export default function Analysis() {
  const { analysis } = useAppStore();

  if (!analysis) {
    return <Redirect to="/" />;
  }

  const { aggregated, funds } = analysis;

  // Pie chart data for broad asset class
  const assetClassData = [
    { name: 'Equity', value: aggregated.equityPercent, fill: 'var(--color-chart-1)' },
    { name: 'Debt', value: aggregated.debtPercent, fill: 'var(--color-chart-2)' },
    { name: 'Cash', value: aggregated.cashPercent, fill: 'var(--color-chart-3)' },
    { name: 'Other', value: aggregated.otherPercent, fill: 'var(--color-chart-4)' },
  ].filter(d => d.value > 0);

  // Sector chart data (Two Rings)
  const outerSectorData = [
    { name: 'Cyclical', value: aggregated.sectors.cyclical, fill: 'hsl(222, 47%, 11%)' }, // Navy
    { name: 'Sensitive', value: aggregated.sectors.sensitive, fill: 'hsl(38, 92%, 50%)' }, // Amber
    { name: 'Defensive', value: aggregated.sectors.defensive, fill: 'hsl(200, 15%, 45%)' }, // Slate
  ].filter(d => d.value > 0);

  const innerSectorData = [
    // Cyclical
    { name: 'Financial', value: aggregated.sectors.financialServices, fill: 'hsl(222, 47%, 20%)' },
    { name: 'Real Estate', value: aggregated.sectors.realEstate, fill: 'hsl(222, 47%, 30%)' },
    { name: 'Consumer Cyc', value: aggregated.sectors.consumerCyclical, fill: 'hsl(222, 47%, 40%)' },
    { name: 'Basic Mat', value: aggregated.sectors.basicMaterials, fill: 'hsl(222, 47%, 50%)' },
    // Sensitive
    { name: 'Communication', value: aggregated.sectors.communicationServices, fill: 'hsl(38, 92%, 40%)' },
    { name: 'Energy', value: aggregated.sectors.energy, fill: 'hsl(38, 92%, 60%)' },
    { name: 'Industrials', value: aggregated.sectors.industrials, fill: 'hsl(38, 92%, 70%)' },
    { name: 'Technology', value: aggregated.sectors.technology, fill: 'hsl(38, 92%, 35%)' },
    // Defensive
    { name: 'Consumer Def', value: aggregated.sectors.consumerDefensive, fill: 'hsl(200, 15%, 35%)' },
    { name: 'Healthcare', value: aggregated.sectors.healthcare, fill: 'hsl(200, 15%, 55%)' },
    { name: 'Utilities', value: aggregated.sectors.utilities, fill: 'hsl(200, 15%, 65%)' },
  ].filter(d => d.value > 0);

  // Market Cap Data
  const mcapData = [
    { name: 'Large Cap', value: aggregated.marketCap.largeCap, fill: 'var(--color-chart-1)' },
    { name: 'Mid Cap', value: aggregated.marketCap.midCap, fill: 'var(--color-chart-2)' },
    { name: 'Small Cap', value: aggregated.marketCap.smallCap, fill: 'var(--color-chart-3)' },
    { name: 'Others', value: aggregated.marketCap.others, fill: 'var(--color-chart-4)' },
  ].filter(d => d.value > 0);

  const formatPercent = (val: number) => `${val.toFixed(2)}%`;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Analysis</h1>
          <p className="text-muted-foreground mt-1">Consolidated view based on Morningstar & Groww holdings data.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-mono text-muted-foreground uppercase mb-1">Total Equity Exposure</span>
          <span className="text-3xl font-bold font-mono text-primary">{aggregated.equityPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Main Dash Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Asset Allocation */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Asset Class</CardTitle>
            <CardDescription>Equity vs Debt breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetClassData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {assetClassData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={formatPercent} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sector Allocation - The Hero Chart */}
        <Card className="md:col-span-2 lg:col-span-1 flex flex-col border-primary/20 shadow-md">
          <CardHeader className="bg-muted/20 pb-4 border-b">
            <CardTitle className="text-xl">Sector Exposure</CardTitle>
            <CardDescription>Cyclical vs Sensitive vs Defensive</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] relative p-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* Outer Ring: Super Sectors */}
                <Pie
                  data={outerSectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={55}
                  dataKey="value"
                  stroke="none"
                >
                  {outerSectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {/* Inner Ring: Sub Sectors */}
                <Pie
                  data={innerSectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  stroke="white"
                  strokeWidth={1}
                >
                  {innerSectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={formatPercent} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 p-3 rounded-md shadow-sm border text-xs font-mono">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[hsl(222,47%,11%)]"></div> Cyclical {aggregated.sectors.cyclical.toFixed(1)}%</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[hsl(38,92%,50%)]"></div> Sensitive {aggregated.sectors.sensitive.toFixed(1)}%</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[hsl(200,15%,45%)]"></div> Defensive {aggregated.sectors.defensive.toFixed(1)}%</div>
            </div>
          </CardContent>
        </Card>

        {/* Market Cap */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Market Capitalization</CardTitle>
            <CardDescription>Size bias across equity</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mcapData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {mcapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={formatPercent} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      <div className="pt-8 border-t space-y-6">
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
