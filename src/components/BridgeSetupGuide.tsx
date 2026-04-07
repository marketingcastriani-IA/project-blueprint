import { useState } from "react";
import { 
  Terminal, Download, ExternalLink, AlertTriangle, Info, 
  ShieldCheck, Monitor, ChevronDown, ChevronUp, BookOpen,
  RefreshCw, CheckCircle2, ArrowRight, Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConStatus } from "@/hooks/useRtdBridge";

interface BridgeSetupGuideProps {
  status: ConStatus;
  errorMsg: string;
  reconnectCount: number;
  connect: () => void;
}

const steps = [
  {
    number: 1,
    title: "Abra o Profit Pro como Administrador",
    description: "Clique com o botão direito no ícone do Profit Pro e selecione \"Executar como administrador\". Isso é obrigatório para o RTD funcionar corretamente.",
    important: true,
    image: "/images/guide-profit-admin.png",
    imageAlt: "Profit Pro - Executar como administrador",
    tip: "O Profit Pro DEVE rodar como Administrador para o servidor RTD ser acessível pelo Bridge.",
  },
  {
    number: 2,
    title: "Selecione o vencimento na Grade de Opções",
    description: "No Profit, vá em Opções (menu superior) e abra a grade de opções do ativo desejado (ex: PETR4). Selecione o vencimento que deseja monitorar para expandir os strikes.",
    image: "/images/guide-profit-opcoes.png",
    imageAlt: "Profit Pro - Grade de opções com vencimentos",
    tip: "A grade de opções no Profit exibe todos os vencimentos disponíveis. Clique no vencimento desejado para expandir os strikes e enviar os dados ao app.",
  },
  {
    number: 3,
    title: "Abra a grade do vencimento desejado",
    description: "Clique no vencimento para expandir a grade com todos os strikes (Calls e Puts). Os dados desta grade serão transmitidos para o Opções PRO X via RTD Bridge.",
    image: "/images/guide-profit-grade.png",
    imageAlt: "Profit Pro - Grade expandida com strikes e preços",
    tip: "Cada linha da grade representa uma opção com seu strike, último preço, delta, intrínseco/extrínseco, bid/ask etc. Esses dados chegam ao app em tempo real.",
  },
  {
    number: 4,
    title: "Baixe e execute o ProfitRTD Bridge",
    description: "Baixe o arquivo .zip (botão abaixo), descompacte em qualquer pasta. Clique com botão direito em \"iniciar_bridge.bat\" e selecione \"Executar como administrador\".",
    important: true,
    image: "/images/guide-run-admin.png",
    imageAlt: "Windows - Executar iniciar_bridge.bat como administrador",
    tip: "O Bridge e o Profit DEVEM rodar com o mesmo nível de permissão. Se o Profit está como Admin, o Bridge também deve estar.",
  },
  {
    number: 5,
    title: "Aguarde a compilação e conexão",
    description: "Na primeira execução, o Bridge compila automaticamente (~60 segundos). Aguarde a mensagem \"WebSocket rodando na porta 8765\". A partir daí, o app conecta automaticamente!",
    tip: "Nas próximas vezes, a compilação é instantânea pois o .exe já estará pronto na pasta \"publish\".",
  },
  {
    number: 6,
    title: "Pronto! Dados fluindo para o app",
    description: "O app Opções PRO X detecta o Bridge automaticamente e começa a receber dados em tempo real. Adicione os tickers que deseja monitorar no campo acima.",
    tip: "O Bridge roda localmente na sua máquina. Nenhum dado é enviado para servidores externos — total segurança.",
  },
];

export default function BridgeSetupGuide({ status, errorMsg, reconnectCount, connect }: BridgeSetupGuideProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showFullGuide, setShowFullGuide] = useState(true);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-warning/5 overflow-hidden">
      <CardContent className="pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight text-foreground">
                Guia de Conexão — ProfitRTD Bridge
              </h3>
              <p className="text-xs text-muted-foreground">
                Configure uma vez, depois é automático
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              asChild
            >
              <a href="/downloads/Manual_Bridge_OpcoesProX.pdf" download>
                <BookOpen className="w-3.5 h-3.5" />
                Manual PDF
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowFullGuide(!showFullGuide)}
            >
              {showFullGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showFullGuide ? "Recolher" : "Expandir guia"}
            </Button>
          </div>
        </div>

        {/* Steps */}
        {showFullGuide && (
          <div className="space-y-3">
            {steps.map((step) => {
              const isExpanded = expandedStep === step.number;
              return (
                <div
                  key={step.number}
                  className={cn(
                    "rounded-xl border transition-all duration-200 cursor-pointer",
                    step.important
                      ? "border-destructive/30 bg-destructive/5 hover:border-destructive/50"
                      : "border-border/50 bg-card/50 hover:border-primary/30",
                    isExpanded && "ring-1 ring-primary/20"
                  )}
                  onClick={() => setExpandedStep(isExpanded ? null : step.number)}
                >
                  {/* Step header */}
                  <div className="flex items-start gap-3 p-3.5">
                    <div className={cn(
                      "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mt-0.5",
                      step.important
                        ? "bg-destructive/20 text-destructive border border-destructive/30"
                        : "bg-primary/15 text-primary border border-primary/25"
                    )}>
                      {step.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "font-bold text-sm",
                          step.important ? "text-destructive" : "text-foreground"
                        )}>
                          {step.title}
                        </span>
                        {step.important && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4 font-black uppercase">
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                            Admin obrigatório
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 space-y-3">
                      {step.image && (
                        <div className="rounded-lg overflow-hidden border border-border/50 shadow-lg">
                          <img
                            src={step.image}
                            alt={step.imageAlt}
                            className="w-full h-auto object-contain bg-muted/30"
                            loading="lazy"
                          />
                        </div>
                      )}
                      {step.tip && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-info/10 border border-info/20 text-xs text-info">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{step.tip}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-2 font-bold shadow-md shadow-primary/10" asChild>
            <a href="/downloads/ProfitRTDBridge.zip" download>
              <Download className="w-3.5 h-3.5" /> Baixar ProfitRTD Bridge v3.2
            </a>
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={connect}>
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Reconectar {reconnectCount > 0 && `(${reconnectCount}/10)`}
          </Button>
          <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" asChild>
            <a href="https://dotnet.microsoft.com/download/dotnet/6.0" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> .NET 6 SDK (gratuito)
            </a>
          </Button>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
          <span>
            O Bridge v3.2 acessa o RTD do Profit <strong className="text-foreground">diretamente via COM — sem precisar de Excel</strong>. 
            Roda <strong className="text-foreground">localmente na sua máquina</strong> e transmite via WebSocket. 
            <strong className="text-foreground"> Nenhum dado sai da sua rede local.</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
