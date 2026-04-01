import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RtdBridgeProvider } from "@/contexts/RtdBridgeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
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
import CalculadoraRendaFixa from "./pages/CalculadoraRendaFixa";

import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/history" element={<PageTransition><History /></PageTransition>} />
        <Route path="/portfolio" element={<PageTransition><Portfolio /></PageTransition>} />
        <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
        <Route path="/diversificador" element={<PageTransition><Diversificador /></PageTransition>} />
        <Route path="/analysis/:id" element={<PageTransition><AnalysisDetail /></PageTransition>} />
        <Route path="/admin-login" element={<PageTransition><AdminLogin /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><AdminPanel /></PageTransition>} />
        <Route path="/faq" element={<PageTransition><FAQ /></PageTransition>} />
        <Route path="/manual" element={<PageTransition><Manual /></PageTransition>} />
        <Route path="/dados-ao-vivo" element={<PageTransition><DadosAoVivo /></PageTransition>} />
        <Route path="/box-tracker" element={<PageTransition><BoxTracker /></PageTransition>} />
        <Route path="/collar-tracker" element={<PageTransition><CollarTracker /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

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
            <ErrorBoundary>
              <AnimatedRoutes />
            </ErrorBoundary>
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
