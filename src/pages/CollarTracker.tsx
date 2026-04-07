import { useState } from "react";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import CollarTrackerTab from "@/components/CollarTrackerTab";
import CollarComparator from "@/components/CollarComparator";
import { ProfessionalLayout } from "@/components/ProfessionalLayout";
import { Button } from "@/components/ui/button";
import { Zap, Lock, Wifi, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

type TabMode = "rastreador" | "comparador";

export default function CollarTracker() {
  const { user } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabMode>("rastreador");

  if (!user) return <Navigate to="/auth" replace />;

  const isPro = access.planType === "pro" || access.isAdmin;

  return (
    <ProfessionalLayout>
      <Header />
      <main className="container py-6">
        {isPro ? (
          <div className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-2">
              <button
                onClick={() => setTab("rastreador")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all",
                  tab === "rastreador"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                )}
              >
                <Wifi className="w-4 h-4" /> Rastreador Tempo Real
              </button>
              <button
                onClick={() => setTab("comparador")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all",
                  tab === "comparador"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                )}
              >
                <Calculator className="w-4 h-4" /> Comparador Manual
              </button>
            </div>

            {tab === "rastreador" ? <CollarTrackerTab /> : <CollarComparator />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <Lock className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Recurso exclusivo PRO</h2>
            <p className="text-muted-foreground text-center max-w-md">
              O Rastreador de Collar está disponível apenas para assinantes PRO. Assine agora para acessar esta e outras funcionalidades avançadas.
            </p>
            <Button
              onClick={() => navigate("/settings")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              <Zap className="h-4 w-4 mr-2" /> Assinar PRO
            </Button>
          </div>
        )}
      </main>
    </ProfessionalLayout>
  );
}
