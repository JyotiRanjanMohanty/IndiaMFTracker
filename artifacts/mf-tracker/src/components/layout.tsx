import { Link, useLocation } from "wouter";
import { useHealthCheck, useDownloadSource, getDownloadSourceQueryKey } from "@workspace/api-client-react";
import { Activity, Download, LayoutDashboard, PieChart, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { analysis } = useAppStore();
  const { data: healthData, isError: isHealthError } = useHealthCheck();
  
  const { refetch: downloadZip, isFetching: isDownloading } = useDownloadSource({ 
    query: { enabled: false, queryKey: getDownloadSourceQueryKey() } 
  });

  const handleDownload = async () => {
    try {
      const { data } = await downloadZip();
      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'source.zip';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const navItems = [
    { href: "/", label: "Portfolio Builder", icon: LayoutDashboard },
    { href: "/analysis", label: "Analysis", icon: PieChart, disabled: !analysis },
    { href: "/about", label: "About", icon: Info },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-secondary selection:text-secondary-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-primary text-primary-foreground shadow-sm">
        <div className="container mx-auto flex h-14 items-center px-4 md:px-6">
          <div className="flex items-center gap-2 mr-6 font-bold text-lg tracking-tight shrink-0">
            <div className="w-6 h-6 rounded-sm bg-secondary flex items-center justify-center">
              <PieChart className="w-4 h-4 text-primary" />
            </div>
            <span>India MF Tracker</span>
          </div>
          
          <nav className="flex flex-1 items-center space-x-1 md:space-x-2 text-sm font-medium">
            {navItems.map((item) => (
              <Link key={item.href} href={item.disabled ? "#" : item.href}>
                <span 
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors
                    ${item.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:bg-primary-foreground/10 cursor-pointer"}
                    ${location === item.href ? "bg-primary-foreground/15 text-white" : "text-primary-foreground/80"}
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 ml-auto">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono">
              <span className="text-primary-foreground/60">SYS_STATUS:</span>
              {isHealthError ? (
                <span className="flex items-center gap-1 text-destructive"><Activity className="w-3 h-3"/> OFFLINE</span>
              ) : healthData ? (
                <span className="flex items-center gap-1 text-secondary"><Activity className="w-3 h-3"/> ONLINE</span>
              ) : (
                <span className="flex items-center gap-1 text-primary-foreground/50"><Activity className="w-3 h-3 animate-pulse"/> PINGING...</span>
              )}
            </div>
            
            <Button 
              variant="secondary" 
              size="sm" 
              className="gap-2 h-8 font-semibold shadow-sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isDownloading ? "Zipping..." : "Source"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full container mx-auto px-4 md:px-6 py-6 md:py-8">
        {children}
      </main>
      
      <footer className="py-6 border-t mt-auto text-center text-sm text-muted-foreground font-mono">
        <p>INDICATIVE ALLOCATIONS ONLY • NOT FINANCIAL ADVICE</p>
      </footer>
    </div>
  );
}
