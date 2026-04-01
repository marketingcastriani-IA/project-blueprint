// ============================================================
// Shared B3 utilities used by BoxTracker, CollarTracker, etc.
// ============================================================

/**
 * Calculate business days between today and a target date string.
 * Supports "dd/MM/yyyy" and "yyyy-MM-dd" formats.
 */
export function calcDiasUteis(vencimentoStr: string | null): number | null {
  if (!vencimentoStr) return null;
  let target: Date | null = null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(vencimentoStr)) {
    const [d, m, y] = vencimentoStr.split("/").map(Number);
    target = new Date(y, m - 1, d);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(vencimentoStr)) {
    target = new Date(vencimentoStr);
  } else {
    return null;
  }
  if (isNaN(target.getTime())) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  if (target <= hoje) return 0;

  let dias = 0;
  const cursor = new Date(hoje);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias++;
  }
  return dias;
}

/**
 * CDI period return given business days and annual CDI rate.
 */
export function calcCdiPeriodo(diasUteis: number, cdiAnual: number): number {
  return ((1 + cdiAnual / 100) ** (diasUteis / 252) - 1) * 100;
}

/**
 * Generate a short random ID.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Format a number as BRL currency string.
 */
export function formatBRL(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `R$ ${val.toFixed(2).replace(".", ",")}`;
}

/**
 * Format a number as percentage string.
 */
export function formatPercent(val: number | null): string {
  if (val === null) return "—";
  return `${val.toFixed(2).replace(".", ",")}%`;
}

/**
 * Extract strike price from a B3 option ticker.
 * Supports: PETR4B28, VALE3A100, BOVA11B28, PETRB28, etc.
 */
export function extractStrikeFromTicker(symbol: string): number {
  const clean = symbol.toUpperCase().replace(/\s/g, "");
  const match = clean.match(/[A-X](\d+)$/);
  if (match) {
    const raw = parseInt(match[1]);
    if (raw >= 1000) return raw / 100;
    if (raw >= 100) return raw / 10;
    return raw;
  }
  return 0;
}

/**
 * Extract option type (CALL or PUT) from a B3 option ticker.
 * A-L = CALL, M-X = PUT
 */
export function extractTypeFromTicker(symbol: string): "CALL" | "PUT" {
  const clean = symbol.toUpperCase().replace(/\s/g, "");
  const match = clean.match(/([A-X])\d+$/);
  if (match) {
    const code = match[1].charCodeAt(0) - 65;
    return code <= 11 ? "CALL" : "PUT";
  }
  return "CALL";
}

/**
 * Convert Date to dd/MM/yyyy string.
 */
export function dateToStr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Parse dd/MM/yyyy string to Date.
 */
export function strToDate(s: string): Date | undefined {
  if (!s) return undefined;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  return undefined;
}

/**
 * Calculate months from business days.
 */
export function calcMeses(diasUteis: number | null): string {
  if (diasUteis === null || diasUteis <= 0) return "—";
  const meses = diasUteis / 21;
  return meses < 1 ? `${diasUteis}d` : `${meses.toFixed(1)}m`;
}
