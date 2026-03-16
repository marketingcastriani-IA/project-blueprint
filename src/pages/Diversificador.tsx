import { useState, useCallback, useEffect } from "react";

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

// ─── Paleta de cores disponíveis ──────────────────────────────────────────────

const CORES_DISPONIVEIS = [
  { label: "Violeta",  value: "#a78bfa" },
  { label: "Verde",    value: "#34d399" },
  { label: "Azul",     value: "#60a5fa" },
  { label: "Âmbar",   value: "#f59e0b" },
  { label: "Rosa",     value: "#f472b6" },
  { label: "Vermelho", value: "#f87171" },
  { label: "Ciano",    value: "#22d3ee" },
  { label: "Laranja",  value: "#fb923c" },
  { label: "Lima",     value: "#a3e635" },
  { label: "Branco",   value: "#e4e4e7" },
];

// ─── Dados padrão ─────────────────────────────────────────────────────────────

const ESTRATEGIAS_PADRAO: Estrategia[] = [
  {
    id: "renda-fixa-collar",
    nome: "Renda Fixa / Collar Sintético",
    descricao: "Renda fixa com collar sintético e strangle em Bova11 e Smal11",
    corTexto: "#a78bfa",
    risco: "Baixo",
    ativo: true,
    percentual: 40,
    frequencia: "Mensal",
    vezes: 1,
    minAcoes: 3,
    alavancagem: 2,
    obs: "Alavancagem máx 2x. Strangle somente Bova11 e Smal11.",
  },
  {
    id: "collar-calendario-neutro",
    nome: "Collar Calendário Neutro",
    descricao: "Operações neutras com estrutura de calendário",
    corTexto: "#34d399",
    risco: "Baixo",
    ativo: true,
    percentual: 20,
    frequencia: "Mensal",
    vezes: 1,
    minAcoes: 2,
    alavancagem: 1,
    obs: "Mínimo 2 ações.",
  },
  {
    id: "collar-potencializado",
    nome: "Collar Potencializado",
    descricao: "Potencial 20% na perna de venda de call",
    corTexto: "#60a5fa",
    risco: "Médio",
    ativo: true,
    percentual: 20,
    frequencia: "Mensal",
    vezes: 1,
    minAcoes: 2,
    alavancagem: 1,
    obs: "Potencial 20% a perna de Venda de Call.",
  },
  {
    id: "collar-direcional",
    nome: "Collar Direcional / Venda Coberta",
    descricao: "Direcional com calendário e venda coberta potencializada",
    corTexto: "#f59e0b",
    risco: "Médio",
    ativo: false,
    percentual: 15,
    frequencia: "Semanal",
    vezes: 2,
    minAcoes: 2,
    alavancagem: 1,
    obs: "Mínimo 2 ações.",
  },
  {
    id: "strangle",
    nome: "Strangle",
    descricao: "Somente em Smal11 e Bova11, mensal 500 unid.",
    corTexto: "#f87171",
    risco: "Alto",
    ativo: false,
    percentual: 5,
    frequencia: "Semanal",
    vezes: 4,
    minAcoes: 1,
    alavancagem: 2,
    obs: "Semanal 250+250 (máx 500). A cada R$1.000 aumentar 4 unidades.",
  },
];

// ─── Constantes ───────────────────────────────────────────────────────────────

const FREQUENCIAS: Frequencia[] = ["Semanal", "Quinzenal", "Mensal"];
const RISCOS: Risco[] = ["Baixo", "Médio", "Alto"];

const RISCO_COR: Record<Risco, string> = {
  Baixo: "bg-emerald-900/40 text-emerald-400 border border-emerald-700/40",
  Médio: "bg-yellow-900/40 text-yellow-400 border border-yellow-700/40",
  Alto:  "bg-red-900/40 text-red-400 border border-red-700/40",
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
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors"
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
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 focus-within:border-violet-500 transition-colors">
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-sm text-white outline-none text-right"
        />
        {suffix && <span className="text-xs text-zinc-500 ml-1 flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function FieldSelect<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 transition-colors"
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
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{titulo}</h2>
          <button
            onClick={onFechar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body scrollável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Nome */}
          <FieldText
            label="Nome da estratégia *"
            value={form.nome}
            onChange={(v) => set("nome", v)}
            placeholder="Ex: Collar Sintético Agressivo"
          />

          {/* Descrição */}
          <FieldText
            label="Descrição curta"
            value={form.descricao}
            onChange={(v) => set("descricao", v)}
            placeholder="Ex: Estrutura com venda de put + compra de call"
          />

          {/* Cor */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-zinc-400 font-medium">Cor de identificação</label>
            <div className="flex flex-wrap gap-2 items-center">
              {CORES_DISPONIVEIS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => set("corTexto", c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    form.corTexto === c.value
                      ? "border-white scale-110"
                      : "border-transparent opacity-50 hover:opacity-90"
                  }`}
                  style={{ background: c.value }}
                />
              ))}
              {/* Hex livre */}
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1">
                <div className="w-4 h-4 rounded-full border border-zinc-600" style={{ background: form.corTexto }} />
                <input
                  type="text"
                  value={form.corTexto}
                  onChange={(e) => set("corTexto", e.target.value)}
                  className="bg-transparent text-xs text-zinc-300 outline-none w-20"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </div>

          {/* Percentual + Vezes + Ações + Alavancagem */}
          <div className="grid grid-cols-2 gap-3">
            <FieldNumber
              label="% do portfólio *"
              value={form.percentual} min={1} max={100} suffix="%"
              onChange={(v) => set("percentual", v)}
            />
            <FieldNumber
              label="Vezes por período"
              value={form.vezes} min={1} max={52}
              onChange={(v) => set("vezes", v)}
            />
            <FieldNumber
              label="Mínimo de ações"
              value={form.minAcoes} min={1} max={100}
              onChange={(v) => set("minAcoes", v)}
            />
            <FieldNumber
              label="Alavancagem máx"
              value={form.alavancagem} min={1} max={20} step={0.5} suffix="x"
              onChange={(v) => set("alavancagem", v)}
            />
          </div>

          {/* Frequência + Risco */}
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect
              label="Frequência"
              value={form.frequencia}
              options={FREQUENCIAS}
              onChange={(v) => set("frequencia", v)}
            />
            <FieldSelect
              label="Perfil de risco"
              value={form.risco}
              options={RISCOS}
              onChange={(v) => set("risco", v)}
            />
          </div>

          {/* Toggle ativo */}
          <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Estratégia ativa</p>
              <p className="text-xs text-zinc-500 mt-0.5">Inclui no cálculo de alocação</p>
            </div>
            <button
              onClick={() => set("ativo", !form.ativo)}
              className={`w-12 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${
                form.ativo ? "bg-violet-600" : "bg-zinc-700"
              }`}
            >
              <span className={`w-5 h-5 rounded-full bg-white ml-0.5 transition-transform ${
                form.ativo ? "translate-x-6" : "translate-x-0"
              }`} />
            </button>
          </div>

          {/* Obs */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400 font-medium">Observações / Regras</label>
            <textarea
              value={form.obs}
              onChange={(e) => set("obs", e.target.value)}
              rows={3}
              placeholder="Regras específicas, restrições, notas..."
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500">Valor estimado</p>
              <p className="text-base font-bold tabular-nums" style={{ color: form.corTexto }}>
                {fmt((patrimonio * form.percentual) / 100)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Margem estimada</p>
              <p className="text-base font-bold tabular-nums text-white">
                {fmt(((patrimonio * form.percentual) / 100) * form.alavancagem)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-zinc-800 flex-shrink-0">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!valido}
            onClick={() => onSalvar(form)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              valido
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            Salvar estratégia
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de confirmação de exclusão ─────────────────────────────────────────

function ModalConfirmar({
  nome, onConfirmar, onCancelar,
}: { nome: string; onConfirmar: () => void; onCancelar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6">
        <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/40 flex items-center justify-center mx-auto mb-4 text-xl">
          ⚠
        </div>
        <h3 className="text-base font-semibold text-white text-center mb-2">Excluir estratégia?</h3>
        <p className="text-sm text-zinc-400 text-center mb-6">
          "<span className="text-white font-medium">{nome}</span>" será removida permanentemente.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
          >
            Sim, excluir
          </button>
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
  | null;

export default function Diversificador() {
  const [patrimonio, setPatrimonio] = useState(100000);
  const [inputPatrimonio, setInputPatrimonio] = useState("100000");
  const [estrategias, setEstrategias] = useState<Estrategia[]>(ESTRATEGIAS_PADRAO);
  const [tabAtiva, setTabAtiva] = useState<"config" | "alocacao" | "resumo">("config");
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

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

  // ── CRUD ──────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Modais */}
      {modal?.tipo === "novo" && (
        <ModalEstrategia
          titulo="Nova estratégia"
          inicial={ESTRATEGIA_VAZIA}
          patrimonio={patrimonio}
          onSalvar={salvarNova}
          onFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "editar" && (
        <ModalEstrategia
          titulo="Editar estratégia"
          inicial={modal.estrategia}
          patrimonio={patrimonio}
          onSalvar={salvarEdicao}
          onFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === "excluir" && (
        <ModalConfirmar
          nome={modal.estrategia.nome}
          onConfirmar={() => excluir(modal.estrategia.id)}
          onCancelar={() => setModal(null)}
        />
      )}

      {/* Header sticky */}
      <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Diversificador de Portfólio
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Gestão de estratégias em opções</p>
          </div>
          <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5">
            <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Patrimônio</span>
            <span className="text-sm text-zinc-500">R$</span>
            <input
              type="text"
              value={inputPatrimonio}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                setInputPatrimonio(raw);
                setPatrimonio(parseInt(raw || "0", 10));
              }}
              className="bg-transparent text-white text-base font-semibold outline-none w-32 text-right"
              placeholder="100000"
            />
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
                  tabAtiva === tab
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
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
                  className={`rounded-xl p-3 border ${item.err ? "bg-red-950/30 border-red-800/50" : "bg-zinc-900 border-zinc-800"}`}
                >
                  <p className="text-xs text-zinc-500 mb-1">{item.label}</p>
                  <p className={`text-base font-semibold ${item.err ? "text-red-400" : "text-white"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Alerta > 100% */}
            {somaPercentuais > 100 && (
              <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400">
                <span>⚠</span>
                <span>Soma ({pct(somaPercentuais)}) ultrapassa 100%.</span>
                <button
                  onClick={ajustarEquitativamente}
                  className="ml-auto text-xs bg-red-900/40 hover:bg-red-800/50 border border-red-700/40 px-3 py-1 rounded-lg transition-colors whitespace-nowrap"
                >
                  Auto-ajustar
                </button>
              </div>
            )}

            {/* Lista */}
            <div className="space-y-2">
              {estrategias.map((e) => (
                <div
                  key={e.id}
                  className={`rounded-2xl border transition-all ${
                    e.ativo ? "bg-zinc-900 border-zinc-700" : "bg-zinc-950 border-zinc-800 opacity-60"
                  }`}
                >
                  {/* Linha principal */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                    onClick={() => setExpandidoId(expandidoId === e.id ? null : e.id)}
                  >
                    {/* Toggle ativo */}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}
                      className={`w-10 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${
                        e.ativo ? "bg-violet-600" : "bg-zinc-700"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white ml-1 transition-transform ${
                        e.ativo ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>

                    {/* Dot cor */}
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.corTexto }} />

                    {/* Nome */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: e.ativo ? e.corTexto : "#6b7280" }}>
                        {e.nome}
                      </p>
                      {e.descricao && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{e.descricao}</p>
                      )}
                    </div>

                    {/* Direita */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge label={e.risco} className={RISCO_COR[e.risco]} />
                      <span className="text-sm font-bold text-white tabular-nums w-12 text-right">{e.percentual}%</span>

                      {/* Botão editar */}
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setModal({ tipo: "editar", estrategia: e }); }}
                        title="Editar estratégia"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-zinc-800 transition-colors"
                      >
                        ✎
                      </button>

                      {/* Botão excluir */}
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setModal({ tipo: "excluir", estrategia: e }); }}
                        title="Excluir estratégia"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      >
                        ✕
                      </button>

                      <span className="text-xs text-zinc-600 ml-1">{expandidoId === e.id ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Painel expandido */}
                  {expandidoId === e.id && (
                    <div className="px-4 pb-4 border-t border-zinc-800 pt-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        {[
                          { label: "Frequência",    value: e.frequencia },
                          { label: "Vezes/período", value: `${e.vezes}x` },
                          { label: "Mín. ações",    value: String(e.minAcoes) },
                          { label: "Alavancagem",   value: `${e.alavancagem}x` },
                        ].map((f) => (
                          <div key={f.label} className="bg-zinc-800/50 rounded-xl px-3 py-2">
                            <p className="text-xs text-zinc-500">{f.label}</p>
                            <p className="text-sm font-semibold text-white mt-0.5">{f.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                          <p className="text-xs text-zinc-500">Valor alocado</p>
                          <p className="text-sm font-bold text-white tabular-nums">
                            {fmt((patrimonio * e.percentual) / 100)}
                          </p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl px-3 py-2">
                          <p className="text-xs text-zinc-500">Margem estimada</p>
                          <p className="text-sm font-bold tabular-nums" style={{ color: e.corTexto }}>
                            {fmt(((patrimonio * e.percentual) / 100) * e.alavancagem)}
                          </p>
                        </div>
                      </div>
                      {e.obs && (
                        <p className="text-xs text-zinc-400 bg-zinc-800/40 rounded-xl px-3 py-2 leading-relaxed mb-3">
                          {e.obs}
                        </p>
                      )}
                      <button
                        onClick={() => setModal({ tipo: "editar", estrategia: e })}
                        className="w-full py-2 rounded-xl border border-violet-700/50 text-violet-400 text-sm hover:bg-violet-900/30 transition-colors"
                      >
                        ✎ Editar todos os campos
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Botão nova estratégia */}
            <button
              onClick={() => setModal({ tipo: "novo" })}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-violet-600 hover:text-violet-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              Nova estratégia
            </button>
          </>
        )}

        {/* ══ Tab: Alocação ════════════════════════════════════════════════ */}
        {tabAtiva === "alocacao" && (
          <>
            {/* Barra visual */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
              <p className="text-sm text-zinc-400 mb-3">Distribuição do patrimônio</p>
              <div className="w-full h-8 rounded-lg overflow-hidden flex">
                {alocacoes.map((a) => (
                  <div
                    key={a.estrategia.id}
                    className="h-full transition-all"
                    style={{ width: `${a.estrategia.percentual}%`, background: a.estrategia.corTexto, opacity: 0.8 }}
                    title={`${a.estrategia.nome}: ${pct(a.estrategia.percentual)}`}
                  />
                ))}
                {saldoLivre > 0 && (
                  <div className="h-full bg-zinc-700" style={{ width: `${100 - somaPercentuais}%` }} />
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                {alocacoes.map((a) => (
                  <div key={a.estrategia.id} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: a.estrategia.corTexto }} />
                    <span className="text-xs text-zinc-400">{a.estrategia.nome.split("/")[0].trim()}</span>
                  </div>
                ))}
                {saldoLivre > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-zinc-600" />
                    <span className="text-xs text-zinc-400">Livre</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tabela */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-left">Estratégia</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">%</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Valor</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Margem</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Frequência</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Vezes</th>
                      <th className="px-4 py-3 text-xs font-medium text-zinc-400 text-right">Risco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {alocacoes.map((a) => (
                      <tr key={a.estrategia.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.estrategia.corTexto }} />
                            <span className="font-medium" style={{ color: a.estrategia.corTexto }}>{a.estrategia.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">{pct(a.estrategia.percentual)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium tabular-nums">{fmt(a.valor)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: a.estrategia.corTexto }}>{fmt(a.margemUsada)}</td>
                        <td className="px-4 py-3 text-right text-zinc-400 text-xs">{a.estrategia.frequencia}</td>
                        <td className="px-4 py-3 text-right text-zinc-300 tabular-nums">{a.estrategia.vezes}x</td>
                        <td className="px-4 py-3 text-right">
                          <Badge label={a.estrategia.risco} className={RISCO_COR[a.estrategia.risco]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-700 bg-zinc-800/40">
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-400">TOTAL</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-white tabular-nums">{pct(somaPercentuais)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-white tabular-nums">{fmt(totalAlocado)}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-violet-400 tabular-nums">{fmt(totalMargem)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <p className="text-xs text-zinc-500 mb-1">Saldo livre</p>
                <p className={`text-lg font-bold ${saldoLivre < 0 ? "text-red-400" : "text-emerald-400"}`}>{fmt(saldoLivre)}</p>
              </div>
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <p className="text-xs text-zinc-500 mb-1">Total em margem</p>
                <p className="text-lg font-bold text-violet-400">{fmt(totalMargem)}</p>
              </div>
              <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                <p className="text-xs text-zinc-500 mb-1">Estratégias ativas</p>
                <p className="text-lg font-bold text-white">{ativas.length}</p>
              </div>
            </div>
          </>
        )}

        {/* ══ Tab: Resumo ══════════════════════════════════════════════════ */}
        {tabAtiva === "resumo" && (
          <>
            {alocacoes.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 text-sm">
                Nenhuma estratégia ativa. Ative estratégias na aba "Estratégias".
              </div>
            ) : (
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
                {alocacoes.map((a) => (
                  <div key={a.estrategia.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.estrategia.corTexto }} />
                          <h3 className="text-sm font-semibold" style={{ color: a.estrategia.corTexto }}>{a.estrategia.nome}</h3>
                          <Badge label={a.estrategia.risco} className={RISCO_COR[a.estrategia.risco]} />
                        </div>
                        {a.estrategia.obs && (
                          <p className="text-xs text-zinc-500 mb-2">{a.estrategia.obs}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">{a.estrategia.frequencia} · {a.estrategia.vezes}x</span>
                          <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">Mín. {a.estrategia.minAcoes} ações</span>
                          <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded-full">Alavancagem {a.estrategia.alavancagem}x</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-zinc-500">Valor</p>
                        <p className="text-base font-bold text-white tabular-nums">{fmt(a.valor)}</p>
                        <p className="text-xs text-zinc-500 mt-1">Margem</p>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: a.estrategia.corTexto }}>{fmt(a.margemUsada)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-violet-800/40 bg-violet-950/20 p-5">
              <h3 className="text-sm font-semibold text-violet-300 mb-4">Resumo total</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Patrimônio total",   value: fmt(patrimonio),    color: "text-white" },
                  { label: "Alocado",            value: `${fmt(totalAlocado)} (${pct(somaPercentuais)})`, color: "text-white" },
                  { label: "Margem total usada", value: fmt(totalMargem),   color: "text-violet-400" },
                  { label: "Saldo livre",        value: fmt(saldoLivre),    color: saldoLivre >= 0 ? "text-emerald-400" : "text-red-400" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-zinc-500 mb-0.5">{item.label}</p>
                    <p className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
