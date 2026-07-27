import { useState, useEffect } from "react";

/**
 * Preços de FIM DE DIA (EOD) da B3, gerados pelo robô scripts/gerar-eod-opcoes.mjs
 * a partir do COTAHIST (arquivo oficial gratuito e redistribuível).
 *
 * Fonte primária: raw.githubusercontent.com (repo público) — atualiza sozinho quando
 * o robô noturno commita, SEM precisar republicar o app. Fallback: /opcoes-eod.json do bundle.
 *
 * Usado como fonte de dados quando o Profit (tempo real) NÃO está conectado.
 */

export interface EodRec {
  u: number;        // último (fechamento)
  b?: number;       // melhor oferta de compra (bid) no fechamento
  a?: number;       // melhor oferta de venda (ask) no fechamento
  n?: number;       // número de negócios
  s?: number;       // strike (preço de exercício)
}

export interface EodData {
  ready: boolean;
  data: string | null;                 // data do pregão, ex "2026-07-24"
  opcoes: Map<string, EodRec>;
  ativos: Map<string, EodRec>;
}

const RAW_URL =
  "https://raw.githubusercontent.com/marketingcastriani-IA/project-blueprint/main/public/opcoes-eod.json";
const LOCAL_URL = "/opcoes-eod.json";

const EMPTY: EodData = { ready: false, data: null, opcoes: new Map(), ativos: new Map() };

let cache: EodData | null = null;
let inflight: Promise<EodData> | null = null;

async function fetchFrom(url: string): Promise<EodData | null> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || typeof j !== "object" || !j.opcoes) return null;
    return {
      ready: true,
      data: typeof j.d === "string" ? j.d : null,
      opcoes: new Map(Object.entries(j.opcoes)) as Map<string, EodRec>,
      ativos: new Map(Object.entries(j.ativos || {})) as Map<string, EodRec>,
    };
  } catch {
    return null;
  }
}

async function loadEod(): Promise<EodData> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    // tenta raw do GitHub (mais recente); se falhar, o do bundle
    const data = (await fetchFrom(RAW_URL)) || (await fetchFrom(LOCAL_URL));
    cache = data || EMPTY;
    return cache;
  })();
  return inflight;
}

export function useEodPrices(): EodData {
  const [eod, setEod] = useState<EodData>(cache || EMPTY);
  useEffect(() => {
    let alive = true;
    loadEod().then((d) => { if (alive) setEod(d); });
    return () => { alive = false; };
  }, []);
  return eod;
}
