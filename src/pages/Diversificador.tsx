import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Save, FolderOpen, Trash2, Plus, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Risco = "Baixo" | "Médio" | "Alto";
type Frequencia = "Semanal" | "Quinzenal" | "Mensal";

type Estrategia = {
  id: string;
  nome: string;
  descricao: string;
  corTexto: string;
  risco: Risco;
  ativo: boolean;
  percentual: number;
  frequencia: Frequencia;
  vezes: number;
  minAcoes: number;
  alavancagem: number;
  obs: string;
};

type DiversificacaoSalva = {
  id: string;
  nome: string;
  patrimonio: number;
  created_at: string;
  updated_at: string;
};

// ─── Paleta de cores disponíveis ──────────────────────────────────────────────

const CORES_DISPONIVEIS = [
  { label: "Violeta",  value: "#7c3aed" },
  { label: "Verde",    value: "#059669" },
  { label: "Azul",     value: "#2563eb" },
  { label: "Âmbar",    value: "#d97706" },
  { label: "Rosa",     value: "#db2777" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Ciano",    value: "#0891b2" },
  { label: "Laranja",  value: "#ea580c" },
  { label: "Lima",     value: "#65a30d" },
  { label: "Cinza",    value: "#64748b" },
];

// Ajusta a cor do texto para ter contraste mínimo no fundo (escurece cores
// muito claras, que somem no tema Branco).
function corLegivel(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.65) {
    const d = (c: number) => Math.round(c * 0.5);
    return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
  }
  return hex;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const FREQUENCIAS: Frequencia[] = ["Semanal", "Quinzenal", "Mensal"];
const RISCOS: Risco[] = ["Baixo", "Médio", "Alto"];

const RISCO_COR: Record<Risco, string> = {
  Baixo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40",
  Médio: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40",
  Alto:  "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/40",
};

const ESTRATEGIA_VAZIA: Omit<Estrategia, "id"> = {
  nome: "",
  descricao: "",
  corTexto: "#a78bfa",
  risco: "Baixo",
  ativo: true,
  percentual: 10,
  frequencia: "Mensal",
  vezes: 1,
  minAcoes: 2,
  alavancagem: 1,
  obs: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(v: number) {
  return `${v.toFixed(1)}%`;
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}

function FieldText({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}

function FieldNumber({
  label, value, min, max, step = 1, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <div className="flex items-center gap-1 bg-muted border border-border rounded-lg px-3 py-2 focus-within:border-primary transition-colors">
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-sm text-foreground outline-none text-right"
        />
        {suffix && <span className="text-xs text-muted-foreground ml-1 flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function FieldSelect<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Modal de criação / edição ────────────────────────────────────────────────

type ModalFormProps = {
  inicial: Omit<Estrategia, "id"> & { id?: string };
  titulo: string;
  patrimonio: number;
  onSalvar: (e: Omit<Estrategia, "id"> & { id?: string }) => void;
  onFechar: () => void;
};

function ModalEstrategia({ inicial, titulo, patrimonio, onSalvar, onFechar }: ModalFormProps) {
  const [form, setForm] = useState({ ...inicial });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const valido = form.nome.trim().length > 0 && form.percentual > 0;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
          <button onClick={onFechar} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <FieldText label="Nome da estratégia *" value={form.nome} onChange={(v) => set("nome", v)} placeholder="Ex: Collar Sintético Agressivo" />
          <FieldText label="Descrição curta" value={form.descricao} onChange={(v) => set("descricao", v)} placeholder="Ex: Estrutura com venda de put + compra de call" />

          {/* Cor */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground font-medium">Cor de identificação</label>
            <div className="flex flex-wrap gap-2 items-center">
              {CORES_DISPONIVEIS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => set("corTexto", c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.corTexto === c.value ? "border-foreground scale-110" : "border-transparent opacity-50 hover:opacity-90"
                  }`}
                  style={{ background: c.value }}
                />
              ))}
              <div className="flex items-center gap-2 bg-muted border border-border rounded-full px-3 py-1">
                <div className="w-4 h-4 rounded-full border border-border" style={{ background: form.corTexto }} />
                <input
                  type="text"
                  value={form.corTexto}
                  onChange={(e) => set("corTexto", e.target.value)}
                  className="bg-transparent text-xs text-muted-foreground outline-none w-20"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldNumber label="% do portfólio *" value={form.percentual} min={1} max={100} suffix="%" onChange={(v) => set("percentual", v)} />
            <FieldNumber label="Vezes por período" value={form.vezes} min={1} max={52} onChange={(v) => set("vezes", v)} />
            <FieldNumber label="Mínimo de ações" value={form.minAcoes} min={1} max={100} onChange={(v) => set("minAcoes", v)} />
            <FieldNumber label="Alavancagem máx" value={form.alavancagem} min={1} max={20} step={0.5} suffix="x" onChange={(v) => set("alavancagem", v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldSelect label="Frequência" value={form.frequencia} options={FREQUENCIAS} onChange={(v) => set("frequencia", v)} />
            <FieldSelect label="Perfil de risco" value={form.risco} options={RISCOS} onChange={(v) => set("risco", v)} />
          </div>

          {/* Toggle ativo */}
          <div className="flex items-center justify-between bg-muted/60 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Estratégia ativa</p>
              <p className="text-xs text-muted-foreground mt-0.5">Inclui no cálculo de alocação</p>
            </div>
            <button
              onClick={() => set("ativo", !form.ativo)}
              className={`w-12 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${form.ativo ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`w-5 h-5 rounded-full bg-primary-foreground ml-0.5 transition-transform ${form.ativo ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Observações / Regras</label>
            <textarea
              value={form.obs}
              onChange={(e) => set("obs", e.target.value)}
              rows={3}
              placeholder="Regras específicas, restrições, notas..."
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none focus:border-primary transition-colors"
            />
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor estimado</p>
              <p className="text-base font-bold tabular-nums" style={{ color: corLegivel(form.corTexto) }}>
                {fmt((patrimonio * form.percentual) / 100)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Margem estimada</p>
              <p className="text-base font-bold tabular-nums text-foreground">
                {fmt(((patrimonio * form.percentual) / 100) * form.alavancagem)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            disabled={!valido}
            onClick={() => onSalvar(form)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              valido ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            Salvar estratégia
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de confirmação ─────────────────────────────────────────────────────

function ModalConfirmar({
  nome, onConfirmar, onCancelar,
}: { nome: string; onConfirmar: () => void; onCancelar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
        <div className="w-12 h-12 rounded-full bg-destructive/20 border border-destructive/40 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-destructive" />
        </div>
        <h3 className="text-base font-semibold text-foreground text-center mb-2">Excluir estratégia?</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          "<span className="text-foreground font-medium">{nome}</span>" será removida permanentemente.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancelar} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirmar} className="flex-1 py-2.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-semibold transition-colors">
            Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Salvar Diversificação ──────────────────────────────────────────────

function ModalSalvar({ onSalvar, onFechar, nomeInicial }: { onSalvar: (nome: string) => void; onFechar: () => void; nomeInicial?: string }) {
  const [nome, setNome] = useState(nomeInicial || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Salvar diversificação</h3>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da diversificação"
          className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            disabled={!nome.trim()}
            onClick={() => onSalvar(nome.trim())}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              nome.trim() ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Carregar Diversificação ────────────────────────────────────────────

function ModalCarregar({ lista, onCarregar, onExcluir, onFechar }: {
  lista: DiversificacaoSalva[];
  onCarregar: (id: string) => void;
  onExcluir: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">Minhas diversificações</h2>
          <button onClick={onFechar} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma diversificação salva.</p>
          ) : (
            lista.map((d) => (
              <div key={d.id} className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3 hover:bg-muted transition-colors">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onCarregar(d.id)}>
                  <p className="text-sm font-semibold text-foreground truncate">{d.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(d.patrimonio)} · {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => onExcluir(d.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type ModalState =
  | { tipo: "novo" }
  | { tipo: "editar"; estrategia: Estrategia }
  | { tipo: "excluir"; estrategia: Estrategia }
  | { tipo: "salvar" }
  | { tipo: "carregar" }
  | null;

export default function Diversificador() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patrimonio, setPatrimonio] = useState(100000);
  const [inputPatrimonio, setInputPatrimonio] = useState("100000");
  const [estrategias, setEstrategias] = useState<Estrategia[]>([]);
  const [tabAtiva, setTabAtiva] = useState<"config" | "alocacao" | "resumo">("config");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [diversificacaoAtualId, setDiversificacaoAtualId] = useState<string | null>(null);
  const [diversificacaoAtualNome, setDiversificacaoAtualNome] = useState<string>("");
  const [listaSalvas, setListaSalvas] = useState<DiversificacaoSalva[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Computed ──────────────────────────────────────────────────────────────

  const ativas = estrategias.filter((e) => e.ativo);
  const somaPercentuais = ativas.reduce((acc, e) => acc + e.percentual, 0);

  const alocacoes = ativas.map((e) => {
    const valor = (patrimonio * e.percentual) / 100;
    return { estrategia: e, valor, margemUsada: valor * e.alavancagem };
  });

  const totalAlocado = alocacoes.reduce((a, i) => a + i.valor, 0);
  const totalMargem  = alocacoes.reduce((a, i) => a + i.margemUsada, 0);
  const saldoLivre   = patrimonio - totalAlocado;

  // ── CRUD local ────────────────────────────────────────────────────────────

  const toggle = useCallback((id: string) =>
    setEstrategias((prev) => prev.map((e) => e.id === id ? { ...e, ativo: !e.ativo } : e)),
  []);

  const salvarNova = (form: Omit<Estrategia, "id"> & { id?: string }) => {
    setEstrategias((prev) => [...prev, { ...form, id: uid() } as Estrategia]);
    setModal(null);
  };

  const salvarEdicao = (form: Omit<Estrategia, "id"> & { id?: string }) => {
    setEstrategias((prev) =>
      prev.map((e) => e.id === form.id ? { ...form, id: e.id } as Estrategia : e)
    );
    setModal(null);
  };

  const excluir = (id: string) => {
    setEstrategias((prev) => prev.filter((e) => e.id !== id));
    setModal(null);
  };

  const ajustarEquitativamente = () => {
    const qtd = ativas.length;
    if (!qtd) return;
    const igualPct = Math.floor(100 / qtd);
    const resto = 100 - igualPct * qtd;
    let ativasCount = 0;
    setEstrategias((prev) =>
      prev.map((e) => {
        if (!e.ativo) return e;
        const idx = ativasCount++;
        return { ...e, percentual: igualPct + (idx < resto ? 1 : 0) };
      })
    );
  };

  // ── Supabase: Auto-load última diversificação ao montar ─────────────────

  useEffect(() => {
    if (!user) return;
    const autoLoad = async () => {
      const { data } = await supabase
        .from("diversificacoes")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        await carregarDiversificacao(data[0].id);
      }
    };
    autoLoad();
  }, [user]);

  // ── Supabase: Salvar ──────────────────────────────────────────────────────

  const salvarNoSupabase = async (nome: string) => {
    if (!user) {
      toast({ title: "Faça login para salvar", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (diversificacaoAtualId) {
        // Update existing
        const { error: errUpdate } = await supabase.from("diversificacoes").update({
          nome,
          patrimonio,
        }).eq("id", diversificacaoAtualId);
        if (errUpdate) throw errUpdate;

        // Delete old strategies and re-insert
        const { error: errDel } = await supabase.from("diversificacao_estrategias").delete().eq("diversificacao_id", diversificacaoAtualId);
        if (errDel) throw errDel;

        if (estrategias.length > 0) {
          const { error: errIns } = await supabase.from("diversificacao_estrategias").insert(
            estrategias.map((e) => ({
              diversificacao_id: diversificacaoAtualId,
              nome: e.nome,
              descricao: e.descricao,
              cor_texto: e.corTexto,
              risco: e.risco,
              ativo: e.ativo,
              percentual: e.percentual,
              frequencia: e.frequencia,
              vezes: e.vezes,
              min_acoes: e.minAcoes,
              alavancagem: e.alavancagem,
              obs: e.obs,
            }))
          );
          if (errIns) throw errIns;
        }

        setDiversificacaoAtualNome(nome);
        toast({ title: "Diversificação atualizada!" });
      } else {
        // Create new
        const { data, error } = await supabase.from("diversificacoes").insert({
          user_id: user.id,
          nome,
          patrimonio,
        }).select().single();

        if (error) throw error;

        if (estrategias.length > 0) {
          const { error: errIns } = await supabase.from("diversificacao_estrategias").insert(
            estrategias.map((e) => ({
              diversificacao_id: data.id,
              nome: e.nome,
              descricao: e.descricao,
              cor_texto: e.corTexto,
              risco: e.risco,
              ativo: e.ativo,
              percentual: e.percentual,
              frequencia: e.frequencia,
              vezes: e.vezes,
              min_acoes: e.minAcoes,
              alavancagem: e.alavancagem,
              obs: e.obs,
            }))
          );
          if (errIns) throw errIns;
        }

        setDiversificacaoAtualId(data.id);
        setDiversificacaoAtualNome(nome);
        toast({ title: "Diversificação salva!" });
      }
    } catch (err: any) {
      console.error("Erro ao salvar diversificação:", err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setModal(null);
    }
  };

  // ── Supabase: Listar ──────────────────────────────────────────────────────

  const carregarLista = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("diversificacoes")
      .select("id, nome, patrimonio, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setListaSalvas((data as DiversificacaoSalva[]) || []);
    setModal({ tipo: "carregar" });
  };

  // ── Supabase: Carregar uma diversificação ─────────────────────────────────

  const carregarDiversificacao = async (id: string) => {
    const { data: div } = await supabase.from("diversificacoes").select("*").eq("id", id).single();
    if (!div) return;

    const { data: estrats } = await supabase.from("diversificacao_estrategias").select("*").eq("diversificacao_id", id);

    setPatrimonio(Number(div.patrimonio));
    setInputPatrimonio(String(div.patrimonio));
    setDiversificacaoAtualId(div.id);
    setDiversificacaoAtualNome(div.nome);
    setEstrategias(
      (estrats || []).map((e: any) => ({
        id: e.id,
        nome: e.nome,
        descricao: e.descricao || "",
        corTexto: e.cor_texto || "#a78bfa",
        risco: e.risco as Risco,
        ativo: e.ativo,
        percentual: Number(e.percentual),
        frequencia: e.frequencia as Frequencia,
        vezes: e.vezes,
        minAcoes: e.min_acoes,
        alavancagem: Number(e.alavancagem),
        obs: e.obs || "",
      }))
    );
    setModal(null);
    toast({ title: `"${div.nome}" carregada` });
  };

  // ── Supabase: Excluir diversificação salva ────────────────────────────────

  const excluirDiversificacao = async (id: string) => {
    await supabase.from("diversificacoes").delete().eq("id", id);
    setListaSalvas((prev) => prev.filter((d) => d.id !== id));
    if (diversificacaoAtualId === id) {
      setDiversificacaoAtualId(null);
      setDiversificacaoAtualNome("");
    }
    toast({ title: "Diversificação excluída" });
  };

  // ── Nova diversificação (limpar tudo) ─────────────────────────────────────

  const novaDiversificacao = () => {
    setEstrategias([]);
    setPatrimonio(100000);
    setInputPatrimonio("100000");
    setDiversificacaoAtualId(null);
    setDiversificacaoAtualNome("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Header />

      {/* Modais */}
      {modal?.tipo === "novo" && (
        <ModalEstrategia titulo="Nova estratégia" inicial={ESTRATEGIA_VAZIA} patrimonio={patrimonio} onSalvar={salvarNova} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "editar" && (
        <ModalEstrategia titulo="Editar estratégia" inicial={modal.estrategia} patrimonio={patrimonio} onSalvar={salvarEdicao} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "excluir" && (
        <ModalConfirmar nome={modal.estrategia.nome} onConfirmar={() => excluir(modal.estrategia.id)} onCancelar={() => setModal(null)} />
      )}
      {modal?.tipo === "salvar" && (
        <ModalSalvar nomeInicial={diversificacaoAtualNome} onSalvar={salvarNoSupabase} onFechar={() => setModal(null)} />
      )}
      {modal?.tipo === "carregar" && (
        <ModalCarregar lista={listaSalvas} onCarregar={carregarDiversificacao} onExcluir={excluirDiversificacao} onFechar={() => setModal(null)} />
      )}

      {/* Header com patrimônio */}
      <div className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Diversificador de Portfólio
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {diversificacaoAtualNome ? `📁 ${diversificacaoAtualNome}` : "Nova diversificação (não salva)"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Patrimônio */}
            <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-2.5">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Patrimônio</span>
              <span className="text-sm text-muted-foreground">R$</span>
              <input
                type="text"
                value={inputPatrimonio}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setInputPatrimonio(raw);
                  setPatrimonio(parseInt(raw || "0", 10));
                }}
                className="bg-transparent text-foreground text-base font-semibold outline-none w-32 text-right"
                placeholder="100000"
              />
            </div>

            {/* Ações */}
            <button onClick={novaDiversificacao} title="Nova diversificação" className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setModal({ tipo: "salvar" })} disabled={saving} title="Salvar diversificação" className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" />
            </button>
            <button onClick={carregarLista} title="Carregar diversificação salva" className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {(["config", "alocacao", "resumo"] as const).map((tab) => {
            const labels = { config: "Estratégias", alocacao: "Alocação", resumo: "Resumo" };
            return (
              <button
                key={tab}
                onClick={() => setTabAtiva(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tabAtiva === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* ══ Tab: Estratégias ══════════════════════════════════════════════ */}
        {tabAtiva === "config" && (
          <>
            {/* Cards de status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Patrimônio",    value: fmt(patrimonio),     err: false },
                { label: "Total alocado", value: fmt(totalAlocado),   err: false },
                { label: "% alocado",     value: pct(somaPercentuais), err: somaPercentuais > 100 },
                { label: "Saldo livre",   value: fmt(saldoLivre),     err: saldoLivre < 0 },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl p-3 border ${item.err ? "bg-destructive/10 border-destructive/30" : "bg-card border-border"}`}
                >
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={`text-base font-semibold ${item.err ? "text-destructive" : "text-foreground"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Alerta > 100% */}
            {somaPercentuais > 100 && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
                <span>⚠</span>
                <span>Soma ({pct(somaPercentuais)}) ultrapassa 100%.</span>
                <button
                  onClick={ajustarEquitativamente}
                  className="ml-auto text-xs bg-destructive/20 hover:bg-destructive/30 border border-destructive/30 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
                >
                  Auto-ajustar
                </button>
              </div>
            )}

            {/* Lista */}
            {estrategias.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <p className="text-muted-foreground text-sm">Nenhuma estratégia criada ainda.</p>
                <p className="text-muted-foreground text-xs">Crie suas estratégias personalizadas clicando no botão abaixo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {estrategias.map((e) => (
                  <div
                    key={e.id}
                    className={`rounded-2xl border transition-all ${
                      e.ativo ? "bg-card border-border" : "bg-muted/30 border-border/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => setExpandidoId(expandidoId === e.id ? null : e.id)}>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}
                        className={`w-10 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${e.ativo ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-primary-foreground ml-1 transition-transform ${e.ativo ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.corTexto }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: e.ativo ? corLegivel(e.corTexto) : undefined }}>
                          {e.nome}
                        </p>
                        {e.descricao && <p className="text-xs text-muted-foreground truncate mt-0.5">{e.descricao}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge label={e.risco} className={RISCO_COR[e.risco]} />
                        <span className="text-sm font-bold text-foreground tabular-nums w-12 text-right">{e.percentual}%</span>
                        <button onClick={(ev) => { ev.stopPropagation(); setModal({ tipo: "editar", estrategia: e }); }} title="Editar" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(ev) => { ev.stopPropagation(); setModal({ tipo: "excluir", estrategia: e }); }} title="Excluir" className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {expandidoId === e.id ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
                      </div>
                    </div>

                    {expandidoId === e.id && (
                      <div className="px-4 pb-4 border-t border-border pt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          {[
                            { label: "Frequência",    value: e.frequencia },
                            { label: "Vezes/período", value: `${e.vezes}x` },
                            { label: "Mín. ações",    value: String(e.minAcoes) },
                            { label: "Alavancagem",   value: `${e.alavancagem}x` },
                          ].map((f) => (
                            <div key={f.label} className="bg-muted/50 rounded-xl px-3 py-2">
                              <p className="text-xs text-muted-foreground">{f.label}</p>
                              <p className="text-sm font-semibold text-foreground mt-0.5">{f.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-muted/50 rounded-xl px-3 py-2">
                            <p className="text-xs text-muted-foreground">Valor alocado</p>
                            <p className="text-sm font-bold text-foreground tabular-nums">{fmt((patrimonio * e.percentual) / 100)}</p>
                          </div>
                          <div className="bg-muted/50 rounded-xl px-3 py-2">
                            <p className="text-xs text-muted-foreground">Margem estimada</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: corLegivel(e.corTexto) }}>{fmt(((patrimonio * e.percentual) / 100) * e.alavancagem)}</p>
                          </div>
                        </div>
                        {e.obs && <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 leading-relaxed mb-3">{e.obs}</p>}
                        <button onClick={() => setModal({ tipo: "editar", estrategia: e })} className="w-full py-2 rounded-xl border border-primary/50 text-primary text-sm hover:bg-primary/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5 inline mr-1" /> Editar todos os campos
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Botão nova estratégia */}
            <button
              onClick={() => setModal({ tipo: "novo" })}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova estratégia
            </button>
          </>
        )}

        {/* ══ Tab: Alocação ════════════════════════════════════════════════ */}
        {tabAtiva === "alocacao" && (
          <>
            <div className={cn("rounded-2xl bg-card border p-4", somaPercentuais > 100 ? "border-destructive border-2 shadow-[0_0_20px_-4px_hsl(var(--destructive)/0.3)]" : "border-border")}>
              {somaPercentuais > 100 && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-destructive/10 text-destructive text-sm font-bold">
                  <span>⚠️ Soma dos percentuais ({somaPercentuais}%) excede 100%!</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-3">Distribuição do patrimônio</p>
              <div className="w-full h-8 rounded-lg overflow-hidden flex">
                {alocacoes.map((a) => (
                  <div key={a.estrategia.id} className="h-full transition-all" style={{ width: `${a.estrategia.percentual}%`, background: a.estrategia.corTexto, opacity: 0.8 }} title={`${a.estrategia.nome}: ${pct(a.estrategia.percentual)}`} />
                ))}
                {saldoLivre > 0 && <div className="h-full bg-muted" style={{ width: `${100 - somaPercentuais}%` }} />}
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {alocacoes.map((a) => (
                  <div key={a.estrategia.id} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: a.estrategia.corTexto }} />
                    <span className="text-xs text-muted-foreground">{a.estrategia.nome.split("/")[0].trim()}</span>
                  </div>
                ))}
                {saldoLivre > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-muted" />
                    <span className="text-xs text-muted-foreground">Livre</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-left">Estratégia</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">%</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Valor</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Margem</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Frequência</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Vezes</th>
                      <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">Risco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {alocacoes.map((a) => (
                      <tr key={a.estrategia.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.estrategia.corTexto }} />
                            <span className="font-medium" style={{ color: corLegivel(a.estrategia.corTexto) }}>{a.estrategia.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-foreground/80 tabular-nums">{pct(a.estrategia.percentual)}</td>
                        <td className="px-4 py-3 text-right text-foreground font-medium tabular-nums">{fmt(a.valor)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: corLegivel(a.estrategia.corTexto) }}>{fmt(a.margemUsada)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-xs">{a.estrategia.frequencia}</td>
                        <td className="px-4 py-3 text-right text-foreground/80 tabular-nums">{a.estrategia.vezes}x</td>
                        <td className="px-4 py-3 text-right"><Badge label={a.estrategia.risco} className={RISCO_COR[a.estrategia.risco]} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">TOTAL</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-foreground tabular-nums">{pct(somaPercentuais)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-foreground tabular-nums">{fmt(totalAlocado)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-primary tabular-nums">{fmt(totalMargem)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Saldo livre</p>
                <p className={`text-lg font-bold ${saldoLivre < 0 ? "text-destructive" : "text-emerald-400"}`}>{fmt(saldoLivre)}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Total em margem</p>
                <p className="text-lg font-bold text-primary">{fmt(totalMargem)}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Estratégias ativas</p>
                <p className="text-lg font-bold text-foreground">{ativas.length}</p>
              </div>
            </div>
          </>
        )}

        {/* ══ Tab: Resumo ══════════════════════════════════════════════════ */}
        {tabAtiva === "resumo" && (
          <>
            {alocacoes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                Nenhuma estratégia ativa. Crie e ative estratégias na aba "Estratégias".
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border divide-y divide-border">
                {alocacoes.map((a) => (
                  <div key={a.estrategia.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.estrategia.corTexto }} />
                          <h3 className="text-sm font-semibold" style={{ color: corLegivel(a.estrategia.corTexto) }}>{a.estrategia.nome}</h3>
                          <Badge label={a.estrategia.risco} className={RISCO_COR[a.estrategia.risco]} />
                        </div>
                        {a.estrategia.obs && <p className="text-xs text-muted-foreground mb-2">{a.estrategia.obs}</p>}
                        <div className="flex flex-wrap gap-2">
                          <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{a.estrategia.frequencia} · {a.estrategia.vezes}x</span>
                          <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">Mín. {a.estrategia.minAcoes} ações</span>
                          <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">Alavancagem {a.estrategia.alavancagem}x</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Valor</p>
                        <p className="text-base font-bold text-foreground tabular-nums">{fmt(a.valor)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Margem</p>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: corLegivel(a.estrategia.corTexto) }}>{fmt(a.margemUsada)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="text-sm font-semibold text-primary mb-4">Resumo total</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Patrimônio total",   value: fmt(patrimonio),    color: "text-foreground" },
                  { label: "Alocado",            value: `${fmt(totalAlocado)} (${pct(somaPercentuais)})`, color: "text-foreground" },
                  { label: "Margem total usada", value: fmt(totalMargem),   color: "text-primary" },
                  { label: "Saldo livre",        value: fmt(saldoLivre),    color: saldoLivre >= 0 ? "text-emerald-400" : "text-destructive" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
