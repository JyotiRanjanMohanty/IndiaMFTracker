import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { PortfolioAnalysis } from '@workspace/api-client-react';

interface AppState {
  analysis: PortfolioAnalysis | null;
  setAnalysis: (data: PortfolioAnalysis | null) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  return (
    <AppContext.Provider value={{ analysis, setAnalysis }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
}
