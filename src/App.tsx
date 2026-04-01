import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RtdBridgeProvider } from "@/contexts/RtdBridgeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import AnalysisDetail from "./pages/AnalysisDetail";
import Portfolio from "./pages/Portfolio";
import Settings from "./pages/Settings";
import Diversificador from "./pages/Diversificador";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import FAQ from "./pages/FAQ";
import Manual from "./pages/Manual";
import DadosAoVivo from "./pages/DadosAoVivo";
import BoxTracker from "./pages/BoxTracker";
import CollarTracker from "./pages/CollarTracker";

import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <RtdBridgeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/diversificador" element={<Diversificador />} />
              <Route path="/analysis/:id" element={<AnalysisDetail />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/manual" element={<Manual />} />
              <Route path="/dados-ao-vivo" element={<DadosAoVivo />} />
              <Route path="/box-tracker" element={<BoxTracker />} />
              <Route path="/collar-tracker" element={<CollarTracker />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <footer className="border-t border-border/60 bg-background/95 px-4 py-2 text-[10px] text-muted-foreground backdrop-blur">
            <div className="container text-center">
              AVISO LEGAL: Ferramenta de simulação baseada nas regras da B3. Não constitui recomendação de investimento. Verifique com sua corretora antes de operar.
            </div>
          </footer>
        </TooltipProvider>
        </RtdBridgeProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
