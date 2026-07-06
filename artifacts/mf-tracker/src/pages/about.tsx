import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Database, ShieldAlert, Cpu } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">About This Tool</h1>
        <p className="text-muted-foreground text-lg">Understanding the methodology and data sources behind the India Mutual Fund Portfolio Tracker.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cpu className="w-5 h-5 text-primary" />
              Methodology
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-foreground/80 leading-relaxed">
            <p>
              Most investors hold multiple mutual funds, often creating overlap and unintended sector concentrations. 
              A 10% allocation to a Tech fund and a 20% allocation to a Flexi-cap fund with high IT exposure 
              can secretly over-expose your portfolio to a single sector.
            </p>
            <p>
              This tool aggregates your systematic investment allocations to calculate the <strong>true underlying exposure</strong> of your portfolio across asset classes, market capitalizations, and the 11 Morningstar global equity sectors.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="w-5 h-5 text-secondary" />
              Data Sources
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                AMFI (Association of Mutual Funds in India)
              </h3>
              <p className="text-sm text-muted-foreground pl-4">
                Used for the live autocomplete database, providing official scheme codes, correct nomenclature, and fund categorization.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                Morningstar India
              </h3>
              <p className="text-sm text-muted-foreground pl-4">
                Scraped on-demand to fetch institutional-grade sector breakdowns. Morningstar standardizes equity holdings into 3 Super Sectors (Cyclical, Sensitive, Defensive) and 11 sub-sectors, providing an apples-to-apples comparison across funds.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                Groww
              </h3>
              <p className="text-sm text-muted-foreground pl-4">
                Used as a secondary data source to extract reliable Large/Mid/Small cap breakdowns, which are often categorized inconsistently across different AMCs.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-4 rounded-lg border border-blue-100 dark:border-blue-900">
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Disclaimer</p>
            <p className="opacity-90">
              This tool performs live web scraping. Data accuracy is dependent on the availability and structure of the source websites at the time of query. Not registered with SEBI. For informational purposes only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
