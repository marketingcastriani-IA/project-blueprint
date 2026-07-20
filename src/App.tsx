import { lazy, Suspense, useEffect } from "react";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RtdBridgeProvider } from "@/contexts/RtdBridgeContext";
import { B3OptionsProvider } from "@/contexts/B3OptionsContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import ScrollToTop from "./components/ScrollToTop";
import Footer from "./components/Footer";

// Eager: landing + auth (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy: all other routes
const Dashboard = lazy(() => import("./pages/Dashboard"));
const History = lazy(() => import("./pages/History"));
const AnalysisDetail = lazy(() => import("./pages/AnalysisDetail"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Settings = lazy(() => import("./pages/Settings"));
const Diversificador = lazy(() => import("./pages/Diversificador"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Manual = lazy(() => import("./pages/Manual"));
const DadosAoVivo = lazy(() => import("./pages/DadosAoVivo"));
const BoxTracker = lazy(() => import("./pages/BoxTracker"));
const CollarTracker = lazy(() => import("./pages/CollarTracker"));
const CalculadoraRendaFixa = lazy(() => import("./pages/CalculadoraRendaFixa"));
const TickerOpcoes = lazy(() => import("./pages/TickerOpcoes"));
const StrategyTracker = lazy(() => import("./pages/StrategyTracker"));
const Suporte = lazy(() => import("./pages/Suporte"));

const queryClient = new QueryClient();

function LazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<LazyFallback />}>
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
          <Route path="/calculadora-renda-fixa" element={<PageTransition><CalculadoraRendaFixa /></PageTransition>} />
          <Route path="/ticker-opcoes" element={<PageTransition><TickerOpcoes /></PageTransition>} />
          <Route path="/strategy-tracker" element={<PageTransition><StrategyTracker /></PageTransition>} />
          <Route path="/suporte" element={<PageTransition><Suporte /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <RtdBridgeProvider>
        <B3OptionsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <ErrorBoundary>
              <AnimatedRoutes />
            </ErrorBoundary>
            <Footer />
          </BrowserRouter>
        </TooltipProvider>
        </B3OptionsProvider>
        </RtdBridgeProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
