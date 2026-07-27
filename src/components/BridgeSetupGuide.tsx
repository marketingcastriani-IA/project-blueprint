import { useState } from "react";
import {
  Terminal, Download, AlertTriangle, Info,
  ShieldCheck, ChevronDown, ChevronUp, BookOpen, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConStatus } from "@/hooks/useRtdBridge";

interface BridgeSetupGuideProps {
  status: ConStatus;
  errorMsg: string;
  reconnectCount: number;
  connect: () => void;
}

type Step = {
  number: number;
  title: string;
  description: string;
  important?: boolean;
  tip?: string;
  download?: { href: string; label: string };
};

const steps: Step[] = [
  {
    number: 1,
    title: "Abra o Profit Pro e faça login",
    description: "Abra o Profit normalmente (2 cliques) e faça login. Não precisa ser administrador.",
    tip: "Regra de ouro: Profit e Bridge sempre no MESMO nível. Como o Profit abre normal, o Bridge também roda normal.",
  },
  {
    number: 2,
    title: "Importe a configuração das grades",
    description: "Baixe nosso arquivo e importe no Profit (Arquivo → Importar/Exportar Configurações → Importar → Adicionar). As grades dos ativos aparecem prontas — você só abre o vencimento no passo 5.",
    download: { href: "/downloads/config-profit-opcoesx.prt", label: "Baixar configuração (.prt)" },
    tip: "Depois de importar, abra o Desktop importado no canto superior direito → Desktop.",
  },
  {
    number: 3,
    title: "Baixe e execute o ProfitRTD Bridge",
    description: "Baixe o .zip, descompacte em qualquer pasta e dê 2 cliques em \"iniciar_bridge.bat\" (sem administrador — mesmo nível do Profit).",
    download: { href: "/downloads/ProfitRTDBridge.zip", label: "Baixar Bridge (pronto)" },
    tip: "Já vem pronto (executável) — não precisa instalar nada. Rode no MESMO nível do Profit (normalmente sem admin).",
  },
  {
    number: 4,
    title: "Aguarde a conexão",
    description: "Quando aparecer \"WebSocket rodando na porta 8765\" na janela do Bridge, o app conecta sozinho.",
    tip: "Nas próximas vezes a conexão é instantânea — o Bridge já fica pronto.",
  },
  {
    number: 5,
    title: "Abra a grade e expanda o vencimento que vai operar",
    important: true,
    description: "Na grade de opções do ativo (ex: PETR4), clique na seta ▶ ao lado do mês que vai operar (ex: Agosto · 21/08) para abrir os strikes. O Profit só cota as opções que estão abertas E VISÍVEIS — com o mês fechado, os preços não chegam.",
    tip: "Não precisa expandir todos os meses — só o vencimento que o app está usando (por padrão, o próximo). Deixe esse aberto e os dados fluem sozinhos.",
  },
  {
    number: 6,
    title: "Pronto! Dados em tempo real",
    description: "O app detecta o Bridge automaticamente e passa a receber as cotações ao vivo. Tudo automático daqui pra frente.",
  },
];

export default function BridgeSetupGuide({ status, errorMsg, reconnectCount, connect }: BridgeSetupGuideProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showFullGuide, setShowFullGuide] = useState(true);

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-[0_10px_40px_-14px_hsl(var(--primary)/0.3)] overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_22px_-4px_hsl(var(--primary))] shrink-0">
              <Terminal className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-foreground leading-tight">Conectar o Profit em tempo real</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Configure uma vez — depois conecta sozinho.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9" asChild>
              <a href="/downloads/Manual_Bridge_OpcoesProX.pdf" download>
                <BookOpen className="w-3.5 h-3.5" /> Manual PDF
              </a>
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-9 text-muted-foreground" onClick={() => setShowFullGuide(!showFullGuide)}>
              {showFullGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showFullGuide ? "Recolher" : "Ver passos"}
            </Button>
          </div>
        </div>

        {/* Steps */}
        {showFullGuide && (
          <div className="space-y-2.5">
            {steps.map((step) => {
              const isExpanded = expandedStep === step.number;
              return (
                <div
                  key={step.number}
                  className={cn(
                    "rounded-xl border transition-all",
                    step.important ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-border bg-background/60",
                    isExpanded && "ring-2 ring-primary/15"
                  )}
                >
                  <div className="flex items-start gap-3 p-3.5 cursor-pointer" onClick={() => setExpandedStep(isExpanded ? null : step.number)}>
                    <div className={cn(
                      "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mt-0.5 text-white",
                      step.important ? "bg-amber-500" : "bg-primary"
                    )}>
                      {step.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{step.title}</span>
                        {step.important && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 font-black uppercase bg-amber-500 text-white border-0">
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Essencial
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                      {step.download && (
                        <a
                          href={step.download.href}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-2 mt-2.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/25"
                        >
                          <Download className="h-4 w-4" /> {step.download.label}
                        </a>
                      )}
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                  {isExpanded && step.tip && (
                    <div className="px-3.5 pb-3.5">
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-info/10 border border-info/20 text-xs text-info">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{step.tip}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-xs text-destructive font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-2 h-10" onClick={connect}>
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar reconectar {reconnectCount > 0 && `(${reconnectCount}/10)`}
          </Button>
        </div>

        {/* Segurança */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
          <span>
            O Bridge roda <strong className="text-foreground">localmente na sua máquina</strong> e transmite via WebSocket.{" "}
            <strong className="text-foreground">Nenhum dado sai da sua rede.</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
