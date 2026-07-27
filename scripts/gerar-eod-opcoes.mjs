/**
 * Gera public/opcoes-eod.json a partir do COTAHIST diário da B3
 * (Séries Históricas — arquivo oficial, gratuito e redistribuível: dados de fim de dia).
 *
 * Fonte:  https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_D{DDMMAAAA}.ZIP
 * Uso:    node scripts/gerar-eod-opcoes.mjs   (ou: npm run eod)
 *
 * Traz o PREÇO DE FECHAMENTO do último pregão: último, melhor oferta de compra (bid),
 * melhor oferta de venda (ask) e nº de negócios — por código de opção e por ação-base.
 * O app usa isso no "modo Fim de dia" quando o Profit (tempo real) não está conectado.
 *
 * O COTAHIST é fixed-width (posicional). Unzip feito em Node puro (zlib), sem dependências.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";

const OUT = path.resolve("public/opcoes-eod.json");
const BASE = "https://bvmf.bmfbovespa.com.br/InstDados/SerHist";

const dd = (d) => String(d.getUTCDate()).padStart(2, "0");
const mm = (d) => String(d.getUTCMonth() + 1).padStart(2, "0");
const yy = (d) => String(d.getUTCFullYear());

// --- Unzip de um ZIP com 1 arquivo, sem dependências (lê Central Directory) ---
function unzipSingle(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP inválido: EOCD não encontrado.");
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error("ZIP inválido: central directory.");
  const method = buf.readUInt16LE(cdOffset + 10);
  const compSize = buf.readUInt32LE(cdOffset + 20);
  const localOffset = buf.readUInt32LE(cdOffset + 42);
  if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("ZIP inválido: local header.");
  const lNameLen = buf.readUInt16LE(localOffset + 26);
  const lExtraLen = buf.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + lNameLen + lExtraLen;
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return data;              // stored
  if (method === 8) return zlib.inflateRawSync(data); // deflate
  throw new Error("Método de compressão não suportado: " + method);
}

async function downloadCotahist(date) {
  const fname = `COTAHIST_D${dd(date)}${mm(date)}${yy(date)}.ZIP`;
  const res = await fetch(`${BASE}/${fname}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000) return null; // dia sem pregão devolve arquivo minúsculo
  return { fname, txt: unzipSingle(buf).toString("latin1") };
}

async function getLatest() {
  const now = new Date();
  for (let back = 1; back <= 7; back++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - back);
    try {
      const r = await downloadCotahist(d);
      if (r) { console.log(`COTAHIST obtido: ${r.fname}`); return { ...r, dataPregao: `${yy(d)}-${mm(d)}-${dd(d)}` }; }
    } catch (e) { /* tenta a data anterior */ }
  }
  throw new Error("Nenhum COTAHIST diário da B3 nos últimos 7 dias.");
}

// --- Parse fixed-width (layout oficial COTAHIST, registro tipo 01) ---
const fld = (l, a, b) => l.substring(a - 1, b).trim();
const pr = (l, a, b) => { const v = parseInt(fld(l, a, b), 10); return isFinite(v) && v > 0 ? v / 100 : 0; };

function build(txt) {
  const opcoes = {};
  const ativos = {};
  for (const l of txt.split(/\r?\n/)) {
    if (l.substring(0, 2) !== "01") continue;          // só registros de cotação
    const tp = fld(l, 25, 27);                          // TPMERC
    const cod = fld(l, 13, 24);                          // CODNEG
    if (!cod) continue;
    const u = pr(l, 109, 121);                           // PREULT (fechamento)
    const b = pr(l, 122, 134);                           // PREOFC (melhor oferta compra = bid)
    const a = pr(l, 135, 147);                           // PREOFV (melhor oferta venda = ask)
    const n = parseInt(fld(l, 148, 152), 10) || 0;       // TOTNEG (nº de negócios)
    if (tp === "070" || tp === "080") {                  // 070=call, 080=put
      const rec = { u };
      if (b > 0) rec.b = b;
      if (a > 0) rec.a = a;
      if (n > 0) rec.n = n;
      const s = pr(l, 189, 201);                         // PREEXE (strike de exercício)
      if (s > 0) rec.s = s;
      opcoes[cod] = rec;
    } else if (tp === "010") {                            // 010=mercado à vista (ação-base)
      const rec = { u };
      if (b > 0) rec.b = b;
      if (a > 0) rec.a = a;
      ativos[cod] = rec;
    }
  }
  return { opcoes, ativos };
}

const { txt, dataPregao } = await getLatest();
const { opcoes, ativos } = build(txt);
const nOpc = Object.keys(opcoes).length;
const nAtv = Object.keys(ativos).length;

if (nOpc < 3000)
  throw new Error(`Poucas opções (${nOpc}). Abortando para não corromper o arquivo.`);

const payload = {
  d: dataPregao,                       // data do pregão (fechamento)
  geradoEm: new Date().toISOString(),  // quando o robô rodou
  fonte: "B3 COTAHIST (fim de dia)",
  ativos,
  opcoes,
};
fs.writeFileSync(OUT, JSON.stringify(payload));
console.log(`OK: ${nOpc} opções + ${nAtv} ativos (pregão ${dataPregao}) -> ${OUT}`);
