// ============================================================
// COMPARADOR DE COLLARS - Entrada manual para comparação
// Score Combinado = w1*Proteção + w2*Upside - w3*Custo
// PER = Downside Protegido / |Custo Líquido|
// ============================================================

import { useState, useMemo, useCallback } from "react";
import { Plus, Trash2, Trophy, Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── TIPOS ───────────────────────────────────────────────────
interface CollarInput {
  id: string;
  label: string;
  strikePut: number;
  strikeCall: number;
  premioPut: number;
  premioCall: number;
}

interface CollarCalc extends CollarInput {
  custoLiquido: number;
  downsideProtegido: number;
  upsidePermitido: number;
  protecaoPct: number;
  upsidePct: number;
  custoLiquidoPct: number;
  per: number;
  scoreCombinado: number;
  isZeroCost: boolean;
  // CDI comparisons
  rentBaixaPct: number;
  rentAltaPct: number;
  diffCdiBaixa: number;
  diffCdiAlta: number;
}

type RankingMethod = "custo" | "per" | "score";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const CDI_ANUAL_DEFAULT = 14.15;

export default function CollarComparator() {
  const [precoAtivo, setPrecoAtivo] = useState<number>(38.5);
  const [cdiAnual, setCdiAnual] = useState<number>(CDI_ANUAL_DEFAULT);
  const [diasUteis, setDiasUteis] = useState<number>(21);
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>("score");

  const [collars, setCollars] = useState<CollarInput[]>([
    { id: generateId(), label: "A", strikePut: 36, strikeCall: 41, premioPut: 1.2, premioCall: 0.8 },
    { id: generateId(), label: "B", strikePut: 35, strikeCall: 42, premioPut: 0.9, premioCall: 1.0 },
  ]);

  const addCollar = useCallback(() => {
    const nextLabel = LETTERS[collars.length % 26] || `${collars.length + 1}`;
    setCollars((prev) => [
      ...prev,
      { id: generateId(), label: nextLabel, strikePut: 0, strikeCall: 0, premioPut: 0, premioCall: 0 },
    ]);
  }, [collars.length]);

  const removeCollar = useCallback((id: string) => {
    setCollars((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      return filtered.map((c, i) => ({ ...c, label: LETTERS[i % 26] || `${i + 1}` }));
    });
  }, []);

  const updateCollar = useCallback((id: string, field: keyof CollarInput, value: number) => {
    setCollars((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }, []);

  // CDI do período
  const cdiPeriodo = useMemo(() => {
    return ((1 + cdiAnual / 100) ** (diasUteis / 252) - 1) * 100;
  }, [cdiAnual, diasUteis]);

  // Cálculos
  const calculated = useMemo<CollarCalc[]>(() => {
    if (precoAtivo <= 0) return [];
    return collars
      .filter((c) => c.strikeCall > 0 && c.strikePut > 0)
      .map((c) => {
        const custoLiquido = c.premioPut - c.premioCall;
        const downsideProtegido = precoAtivo - c.strikePut;
        const upsidePermitido = c.strikeCall - precoAtivo;
        const protecaoPct = (downsideProtegido / precoAtivo) * 100;
        const upsidePct = (upsidePermitido / precoAtivo) * 100;
        const custoLiquidoPct = (custoLiquido / precoAtivo) * 100;

        const per =
          Math.abs(custoLiquidoPct) > 0.01
            ? Math.abs(protecaoPct / custoLiquidoPct)
            : custoLiquido <= 0
            ? Infinity
            : 0;

        // Score combinado (pesos ajustáveis)
        const w1 = 0.5, w2 = 0.3, w3 = 0.2;
        const scoreCombinado = w1 * protecaoPct + w2 * upsidePct - w3 * custoLiquidoPct;

        // Rentabilidades nos cenários
        // Baixa: ativo cai ao strike da put → perda = downsideProtegido, custo collar
        const rentBaixaPct = ((c.strikePut - precoAtivo + (c.premioCall - c.premioPut)) / precoAtivo) * 100;
        // Alta: ativo sobe ao strike da call → ganho = upside, custo collar
        const rentAltaPct = ((c.strikeCall - precoAtivo + (c.premioCall - c.premioPut)) / precoAtivo) * 100;

        const diffCdiBaixa = rentBaixaPct - cdiPeriodo;
        const diffCdiAlta = rentAltaPct - cdiPeriodo;

        return {
          ...c,
          custoLiquido,
          downsideProtegido,
          upsidePermitido,
          protecaoPct,
          upsidePct,
          custoLiquidoPct,
          per,
          scoreCombinado,
          isZeroCost: custoLiquido <= 0,
          rentBaixaPct,
          rentAltaPct,
          diffCdiBaixa,
          diffCdiAlta,
        };
      });
  }, [collars, precoAtivo, cdiPeriodo]);

  // Ranking
  const ranked = useMemo(() => {
    const sorted = [...calculated];
    if (rankingMethod === "custo") {
      sorted.sort((a, b) => a.custoLiquido - b.custoLiquido);
    } else if (rankingMethod === "per") {
      sorted.sort((a, b) => (b.per === Infinity ? 9999 : b.per) - (a.per === Infinity ? 9999 : a.per));
    } else {
      sorted.sort((a, b) => b.scoreCombinado - a.scoreCombinado);
    }
    return sorted;
  }, [calculated, rankingMethod]);

  // Normalizar score para 0-100
  const normalizedScores = useMemo(() => {
    if (ranked.length === 0) return new Map<string, number>();
    const scores = ranked.map((r) =>
      rankingMethod === "custo"
        ? -r.custoLiquido
        : rankingMethod === "per"
        ? r.per === Infinity ? 9999 : r.per
        : r.scoreCombinado
    );
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const range = max - min || 1;
    const map = new Map<string, number>();
    ranked.forEach((r, i) => {
      map.set(r.id, Math.round(((scores[i] - min) / range) * 100));
    });
    return map;
  }, [ranked, rankingMethod]);

  const best = ranked[0] ?? null;

  const methodDescriptions: Record<RankingMethod, string> = {
    custo: "Custo Líquido = Prêmio Put – Prêmio Call\n↳ Menor valor = melhor (mais barato montar a proteção)",
    per: "PER = Proteção (%) / |Custo Líquido (%)|\n↳ Maior valor = mais proteção por unidade de custo",
    score: "Score = 0.5×Proteção + 0.3×Upside – 0.2×Custo\n↳ Maior valor = melhor equilíbrio geral",
  };

  return (
    <div className="space-y-6">
      {/* ─── PARÂMETROS GLOBAIS ─── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
          Parâmetros do Ativo
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Preço do Ativo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={precoAtivo || ""}
              onChange={(e) => setPrecoAtivo(parseFloat(e.target.value) || 0)}
              className="font-mono font-bold"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">CDI Anual (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={cdiAnual || ""}
              onChange={(e) => setCdiAnual(parseFloat(e.target.value) || 0)}
              className="font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Dias Úteis até Vcto</Label>
            <Input
              type="number"
              step="1"
              value={diasUteis || ""}
              onChange={(e) => setDiasUteis(parseInt(e.target.value) || 0)}
              className="font-mono"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          CDI do período: <span className="font-bold text-warning">{cdiPeriodo.toFixed(4).replace(".", ",")}%</span>
        </p>
      </div>

      {/* ─── COLLARS PARA COMPARAR ─── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Collars para Comparar
          </h3>
          <Button variant="outline" size="sm" onClick={addCollar} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar collar
          </Button>
        </div>

        <div className="space-y-3">
          {collars.map((c) => (
            <div
              key={c.id}
              className="border border-border/50 rounded-lg p-4 bg-muted/20"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-black text-sm text-foreground">Collar {c.label}</span>
                {collars.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCollar(c.id)}
                    className="text-xs text-destructive/60 hover:text-destructive h-7"
                  >
                    remover
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Strike Put</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={c.strikePut || ""}
                    onChange={(e) => updateCollar(c.id, "strikePut", parseFloat(e.target.value) || 0)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Strike Call</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={c.strikeCall || ""}
                    onChange={(e) => updateCollar(c.id, "strikeCall", parseFloat(e.target.value) || 0)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Prêmio Put</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={c.premioPut || ""}
                    onChange={(e) => updateCollar(c.id, "premioPut", parseFloat(e.target.value) || 0)}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Prêmio Call</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={c.premioCall || ""}
                    onChange={(e) => updateCollar(c.id, "premioCall", parseFloat(e.target.value) || 0)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MÉTODO DE RANKING ─── */}
      {calculated.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Método de Ranking
          </h3>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "custo" as RankingMethod, label: "Custo Líquido" },
              { key: "per" as RankingMethod, label: "Eficiência (PER)" },
              { key: "score" as RankingMethod, label: "Score Combinado" },
            ]).map((m) => (
              <button
                key={m.key}
                onClick={() => setRankingMethod(m.key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold border transition-all",
                  rankingMethod === m.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground whitespace-pre-line bg-muted/30 rounded-lg p-3 border border-border/50">
            {methodDescriptions[rankingMethod]}
          </p>
        </div>
      )}

      {/* ─── RANKING DE COLLARS ─── */}
      {ranked.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Ranking de Collars — {precoAtivo > 0 ? `R$ ${precoAtivo.toFixed(2).replace(".", ",")}` : ""}
          </h3>

          <div className="space-y-2">
            {ranked.map((c, i) => {
              const score = normalizedScores.get(c.id) ?? 0;
              const badge = i === 0 ? "melhor" : i === ranked.length - 1 ? "pior" : "ok";
              const badgeColor =
                badge === "melhor"
                  ? "bg-success/20 text-success"
                  : badge === "pior"
                  ? "bg-destructive/20 text-destructive"
                  : "bg-warning/20 text-warning";
              const barColor =
                badge === "melhor"
                  ? "bg-success"
                  : badge === "pior"
                  ? "bg-muted-foreground/40"
                  : "bg-warning";

              return (
                <div
                  key={c.id}
                  className={cn(
                    "border rounded-lg p-3 transition-all",
                    i === 0 ? "border-success/40 bg-success/5" : "border-border/50 bg-muted/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-muted-foreground w-6 text-center">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase", badgeColor)}>
                          {badge}
                        </span>
                        <span className="font-black text-sm text-foreground">Collar {c.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Custo: R$ {Math.abs(c.custoLiquido).toFixed(2).replace(".", ",")} ({c.custoLiquido <= 0 ? "recebe" : "paga"})
                        {" · "}Put {c.strikePut.toFixed(2).replace(".", ",")} / Call {c.strikeCall.toFixed(2).replace(".", ",")}
                        {" · "}PER: {c.per === Infinity ? "∞" : c.per.toFixed(2).replace(".", ",")}
                      </p>
                      {/* CDI comparison line */}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        ↓ Baixa vs CDI:{" "}
                        <span className={cn("font-bold", c.diffCdiBaixa >= 0 ? "text-success" : "text-destructive")}>
                          {c.diffCdiBaixa >= 0 ? "+" : ""}{c.diffCdiBaixa.toFixed(2).replace(".", ",")} pp
                        </span>
                        {" · "}↑ Alta vs CDI:{" "}
                        <span className={cn("font-bold", c.diffCdiAlta >= 0 ? "text-success" : "text-destructive")}>
                          {c.diffCdiAlta >= 0 ? "+" : ""}{c.diffCdiAlta.toFixed(2).replace(".", ",")} pp
                        </span>
                      </p>
                      {/* Progress bar */}
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", barColor)}
                          style={{ width: `${Math.max(score, 3)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xl font-black text-foreground">{score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── DETALHES DO MELHOR COLLAR ─── */}
      {best && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Detalhes do Melhor Collar
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard
              title="Custo líquido"
              value={`R$ ${best.custoLiquido.toFixed(2).replace(".", ",")}`}
              subtitle="Put – Call"
              highlight={best.custoLiquido <= 0}
            />
            <MetricCard
              title="Proteção (downside)"
              value={`${best.protecaoPct.toFixed(1).replace(".", ",")}%`}
              subtitle="% do preço"
            />
            <MetricCard
              title="Upside permitido"
              value={`${best.upsidePct.toFixed(1).replace(".", ",")}%`}
              subtitle="% do preço"
            />
            <MetricCard
              title="PER"
              value={best.per === Infinity ? "∞" : best.per.toFixed(2).replace(".", ",")}
              subtitle="Proteção / Custo"
            />
            <MetricCard
              title="Score combinado"
              value={(normalizedScores.get(best.id) ?? 0).toFixed(1)}
              subtitle="0–100"
            />
            <MetricCard
              title="Zero-cost?"
              value={best.isZeroCost ? "Sim ✓" : "Não ✗"}
              subtitle="Custo ≤ 0"
              highlight={best.isZeroCost}
            />
          </div>

          {/* CDI comparison details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <MetricCard
              title="Rent. se cair (piso)"
              value={`${best.rentBaixaPct.toFixed(2).replace(".", ",")}%`}
              subtitle={`${best.diffCdiBaixa >= 0 ? "+" : ""}${best.diffCdiBaixa.toFixed(2).replace(".", ",")} pp vs CDI`}
              highlight={best.diffCdiBaixa >= 0}
            />
            <MetricCard
              title="Rent. se subir (teto)"
              value={`${best.rentAltaPct.toFixed(2).replace(".", ",")}%`}
              subtitle={`${best.diffCdiAlta >= 0 ? "+" : ""}${best.diffCdiAlta.toFixed(2).replace(".", ",")} pp vs CDI`}
              highlight={best.diffCdiAlta >= 0}
            />
            <MetricCard
              title="CDI do período"
              value={`${cdiPeriodo.toFixed(4).replace(".", ",")}%`}
              subtitle={`${diasUteis} dias úteis`}
            />
            <MetricCard
              title="Custo vs Ativo"
              value={`${best.custoLiquidoPct.toFixed(2).replace(".", ",")}%`}
              subtitle="Custo / Preço"
              highlight={best.custoLiquidoPct <= 0}
            />
          </div>
        </div>
      )}

      {calculated.length < 2 && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">Adicione pelo menos 2 collars com strikes válidos para comparar.</p>
        </div>
      )}
    </div>
  );
}

// ─── METRIC CARD ─────────────────────────────────────────────
function MetricCard({
  title,
  value,
  subtitle,
  highlight,
}: {
  title: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg p-3 border", highlight ? "bg-success/5 border-success/30" : "bg-muted/30 border-border/50")}>
      <p className="text-[10px] text-muted-foreground font-medium">{title}</p>
      <p className={cn("text-xl font-black mt-1", highlight ? "text-success" : "text-foreground")}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
