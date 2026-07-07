import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { 
  useSearchFunds, 
  useAnalyzePortfolio, 
  getSearchFundsQueryKey,
  type FundSuggestion
} from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, Loader2, AlertCircle, TrendingUp, PieChart } from "lucide-react";

interface SelectedFund {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  sipPercent: number;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { setAnalysis } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedFunds, setSelectedFunds] = useState<SelectedFund[]>([]);
  
  const analyzeMutation = useAnalyzePortfolio();
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: suggestions, isLoading: isLoadingSuggestions } = useSearchFunds(
    { q: debouncedQuery },
    { 
      query: { 
        enabled: debouncedQuery.length >= 3,
        queryKey: getSearchFundsQueryKey({ q: debouncedQuery })
      } 
    }
  );

  const totalAllocation = selectedFunds.reduce((sum, f) => sum + f.sipPercent, 0);
  const isValid = totalAllocation === 100 && selectedFunds.length > 0;

  const handleAddFund = (fund: FundSuggestion) => {
    if (selectedFunds.some(f => f.schemeCode === fund.schemeCode)) return;
    
    // Auto-calculate a reasonable remaining percentage
    const remaining = Math.max(0, 100 - totalAllocation);
    
    setSelectedFunds(prev => [...prev, {
      ...fund,
      sipPercent: remaining
    }]);
    setSearchQuery("");
    setDebouncedQuery("");
  };

  const handleRemoveFund = (schemeCode: string) => {
    setSelectedFunds(prev => prev.filter(f => f.schemeCode !== schemeCode));
  };

  const handleUpdatePercent = (schemeCode: string, value: string) => {
    const num = parseInt(value || "0", 10);
    if (isNaN(num)) return;
    
    setSelectedFunds(prev => prev.map(f => 
      f.schemeCode === schemeCode ? { ...f, sipPercent: Math.min(100, Math.max(0, num)) } : f
    ));
  };

  const handleAnalyze = () => {
    if (!isValid) return;
    
    const fundsInput = selectedFunds.map(f => ({
      fundName: f.schemeName,
      schemeCode: f.schemeCode,
      sipPercent: f.sipPercent
    }));

    analyzeMutation.mutate({ data: { funds: fundsInput } }, {
      onSuccess: (data) => {
        setAnalysis(data);
        setLocation("/analysis");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      
      <div className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Command Centre</h1>
        <p className="text-muted-foreground text-lg">Build your systematic investment portfolio to reveal true asset allocation.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Search Column */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Find Funds
              </CardTitle>
              <CardDescription>Search AMFI database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Input 
                    placeholder="e.g. Parag Parikh Flexi Cap..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-muted/50 border-muted focus-visible:ring-secondary"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                </div>
                
                <div className="min-h-[300px] border rounded-md bg-muted/20 overflow-hidden flex flex-col">
                  {searchQuery.length < 3 && !isLoadingSuggestions && (
                    <div className="m-auto text-sm text-muted-foreground text-center p-4">
                      Type at least 3 characters to search.
                    </div>
                  )}
                  {isLoadingSuggestions && (
                    <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Searching...
                    </div>
                  )}
                  {suggestions && suggestions.length === 0 && searchQuery.length >= 3 && !isLoadingSuggestions && (
                    <div className="m-auto text-sm text-muted-foreground text-center p-4">
                      No funds found. Try a different term.
                    </div>
                  )}
                  
                  {suggestions && suggestions.length > 0 && (
                    <div className="overflow-y-auto max-h-[400px]">
                      {suggestions.map((fund) => {
                        const isSelected = selectedFunds.some(f => f.schemeCode === fund.schemeCode);
                        return (
                          <div 
                            key={fund.schemeCode}
                            className={`p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors flex justify-between items-center group ${isSelected ? 'opacity-50 pointer-events-none bg-muted/30' : ''}`}
                            onClick={() => handleAddFund(fund)}
                          >
                            <div className="space-y-1 pr-2 overflow-hidden">
                              <p className="text-sm font-medium leading-tight line-clamp-2">{fund.schemeName}</p>
                              <div className="flex gap-2 text-[10px] text-muted-foreground font-mono">
                                <span className="truncate">{fund.fundHouse}</span>
                                <span>•</span>
                                <span className="truncate">{fund.category}</span>
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-full group-hover:bg-primary group-hover:text-primary-foreground">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Column */}
        <div className="md:col-span-2 space-y-4">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-secondary" />
                    SIP Portfolio
                  </CardTitle>
                  <CardDescription>Allocate exactly 100% across funds</CardDescription>
                </div>
                <div className={`font-mono text-2xl font-bold ${totalAllocation === 100 ? 'text-green-600 dark:text-green-500' : totalAllocation > 100 ? 'text-destructive' : 'text-primary'}`}>
                  {totalAllocation}%
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              {selectedFunds.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3 min-h-[300px]">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                    <PieChart className="w-8 h-8 opacity-20" />
                  </div>
                  <p>Your portfolio is empty.</p>
                  <p className="text-sm">Search and add funds from the left panel to begin.</p>
                </div>
              ) : (
                <div className="divide-y flex-1">
                  <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-8">Fund Name</div>
                    <div className="col-span-3 text-right">Allocation %</div>
                    <div className="col-span-1"></div>
                  </div>
                  <div className="overflow-y-auto max-h-[400px]">
                    {selectedFunds.map((fund) => (
                      <div key={fund.schemeCode} className="grid grid-cols-12 gap-4 px-6 py-4 items-center group">
                        <div className="col-span-8 space-y-1">
                          <p className="text-sm font-medium leading-tight">{fund.schemeName}</p>
                          <Badge variant="outline" className="text-[10px] font-mono font-normal">
                            {fund.category}
                          </Badge>
                        </div>
                        <div className="col-span-3 flex justify-end">
                          <div className="relative w-20">
                            <Input 
                              type="number" 
                              min="0" 
                              max="100"
                              value={fund.sipPercent || ""}
                              onChange={(e) => handleUpdatePercent(fund.schemeCode, e.target.value)}
                              className="pr-6 font-mono text-right border-muted-foreground/30 focus-visible:ring-secondary"
                            />
                            <span className="absolute right-2 top-2.5 text-sm text-muted-foreground font-mono">%</span>
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveFund(fund.schemeCode)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="p-6 border-t mt-auto bg-muted/10">
                {analyzeMutation.isPending ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-secondary font-medium">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Preparing portfolio analysis...
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-secondary h-1.5 rounded-full animate-pulse w-full origin-left" style={{ animationDuration: '2s' }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">This may take 10-30 seconds depending on AMFI load.</p>
                  </div>
                ) : (
                  <Button 
                    size="lg" 
                    className="w-full text-base font-semibold shadow-md relative overflow-hidden" 
                    disabled={!isValid}
                    onClick={handleAnalyze}
                  >
                    {!isValid && totalAllocation !== 100 && selectedFunds.length > 0 && (
                      <span className="absolute left-4 opacity-50"><AlertCircle className="w-5 h-5"/></span>
                    )}
                    {selectedFunds.length === 0 
                      ? "Add funds to analyze" 
                      : totalAllocation !== 100 
                        ? `Adjust allocation (Currently ${totalAllocation}%)` 
                        : "Analyze Portfolio"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
