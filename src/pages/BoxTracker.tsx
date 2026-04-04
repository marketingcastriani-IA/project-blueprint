import { useAccessControl } from "@/hooks/useAccessControl";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import BoxTrackerTab from "@/components/BoxTrackerTab";
import { ProfessionalLayout } from "@/components/ProfessionalLayout";
import { Button } from "@/components/ui/button";
import { Zap, Lock } from "lucide-react";

export default function BoxTracker() {
  const { user } = useAuth();
  const access = useAccessControl();

  if (!user) return <Navigate to="/auth" replace />;

  const isPro = access.planType === "pro" || access.isAdmin;

  return (
    <ProfessionalLayout>
      <Header />
      <main className="container py-6">
        {isPro ? (
          <BoxTrackerTab />
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <Lock className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Recurso exclusivo PRO</h2>
            <p className="text-muted-foreground text-center max-w-md">
              O Rastreador de Box está disponível apenas para assinantes PRO. Assine agora para acessar esta e outras funcionalidades avançadas.
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
