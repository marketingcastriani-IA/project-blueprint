/**
 * Gera public/opcoes.json a partir do InstrumentsConsolidatedFile da B3
 * (cadastro oficial de instrumentos — gratuito e público).
 *
 * Fonte:  https://arquivos.b3.com.br  (arquivo diário, todos os instrumentos)
 * Uso:    node scripts/gerar-catalogo-opcoes.mjs
 *
 * O catálogo traz apenas a LISTA de opções (código, strike ajustado, vencimento,
 * tipo, família). Preço/bid/ask ao vivo vêm do Profit via RTD no app.
 */
import fs from "fs";
import path from "path";

const OUT = path.resolve("public/opcoes.json");
const BASE = "https://arquivos.b3.com.br/api/download";

const ymd = (d) => d.toISOString().slice(0, 10);
const toDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null; // 2026-08-21 -> 21/08/2026
};
const familyOf = (asst) => (asst || "").replace(/\d+$/, ""); // ITUB4 -> ITUB

async function tokenFor(date) {
  const res = await fetch(`${BASE}/requestname?fileName=InstrumentsConsolidatedFile&date=${date}`);
  if (!res.ok) return null;
  const j = await res.json();
  const m = /token=([^"&]+)/.exec(j.redirectUrl || "");
  return m ? m[1] : null;
}

async function downloadFor(date) {
  const token = await tokenFor(date);
  if (!token) return null;
  const res = await fetch(`${BASE}/?token=${token}`);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1_000_000) return null; // arquivo pequeno demais = inválido
  return buf.toString("latin1"); // B3 usa ISO-8859-1
}

async function getLatestFile() {
  const now = new Date();
  for (let back = 0; back <= 6; back++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - back);
    const date = ymd(d);
    try {
      const txt = await downloadFor(date);
      if (txt) { console.log(`Arquivo B3 obtido: ${date}`); return txt; }
    } catch { /* tenta a data anterior */ }
  }
  throw new Error("Nenhum arquivo de instrumentos da B3 nos últimos 7 dias.");
}

function build(csv) {
  const lines = csv.split(/\r?\n/);
  const hi = lines.findIndex((l) => l.startsWith("RptDt;"));
  if (hi < 0) throw new Error("Cabeçalho (RptDt;...) não encontrado.");
  const header = lines[hi].split(";");
  const col = (n) => header.indexOf(n);
  const iCod = col("TckrSymb"), iAsst = col("Asst"), iVenc = col("XprtnDt"),
        iTp = col("OptnTp"), iStrike = col("ExrcPric");
  if ([iCod, iAsst, iVenc, iTp, iStrike].some((x) => x < 0))
    throw new Error("Colunas esperadas ausentes no arquivo da B3.");

  const out = [];
  const seen = new Set();
  for (let i = hi + 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    if (c.length < header.length) continue;
    const tp = c[iTp];
    if (tp !== "Call" && tp !== "Put") continue; // só opções
    const cod = c[iCod]?.trim();
    const asst = c[iAsst]?.trim();
    const strike = parseFloat((c[iStrike] || "").replace(",", "."));
    const venc = toDate(c[iVenc]);
    if (!cod || !asst || !venc || !(strike > 0)) continue;
    const key = `${cod}|${venc}`;
    if (seen.has(key)) continue; // um código = um contrato
    seen.add(key);
    out.push({ t: cod, s: strike, v: venc, tp: tp === "Call" ? "C" : "P", p: 0, f: familyOf(asst) });
  }
  return out;
}

const csv = await getLatestFile();
const cat = build(csv);
// Salvaguarda: não sobrescreve com dado suspeito
if (cat.length < 10000)
  throw new Error(`Catálogo suspeito (${cat.length} opções). Abortando para não corromper o arquivo.`);

fs.writeFileSync(OUT, JSON.stringify(cat));
const familias = new Set(cat.map((o) => o.f)).size;
console.log(`OK: ${cat.length} opções, ${familias} famílias -> ${OUT}`);
