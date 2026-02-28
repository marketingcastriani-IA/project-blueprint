// B3 Calendar Engine - Dynamic for any year

const CALL_LETTERS = 'ABCDEFGHIJKL';
const PUT_LETTERS = 'MNOPQRSTUVWX';

// Brazilian bank holidays that are FIXED dates (recur every year)
const FIXED_HOLIDAYS = [
  { month: 1, day: 1 },   // Confraternização Universal
  { month: 4, day: 21 },  // Tiradentes
  { month: 5, day: 1 },   // Dia do Trabalho
  { month: 9, day: 7 },   // Independência
  { month: 10, day: 12 }, // N. Sra. Aparecida
  { month: 11, day: 2 },  // Finados
  { month: 11, day: 15 }, // Proclamação da República
  { month: 11, day: 20 }, // Consciência Negra
  { month: 12, day: 25 }, // Natal
];

// Easter-based holidays use a helper
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getBankHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // Fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    holidays.add(formatDateKey(new Date(year, h.month - 1, h.day)));
  }

  // Easter-based movable holidays
  const easter = getEasterDate(year);
  const easterMs = easter.getTime();
  const day = 24 * 60 * 60 * 1000;

  // Carnaval (47 and 48 days before Easter)
  holidays.add(formatDateKey(new Date(easterMs - 47 * day)));
  holidays.add(formatDateKey(new Date(easterMs - 48 * day)));

  // Sexta-feira Santa (2 days before Easter)
  holidays.add(formatDateKey(new Date(easterMs - 2 * day)));

  // Corpus Christi (60 days after Easter)
  holidays.add(formatDateKey(new Date(easterMs + 60 * day)));

  return holidays;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculate the 3rd Friday of a given month/year, adjusted for holidays
function getThirdFriday(year: number, month: number): Date {
  // month is 1-based
  const firstDay = new Date(year, month - 1, 1);
  const firstDow = firstDay.getDay(); // 0=Sun
  // Find first Friday: day of week 5
  let firstFriday = 1 + ((5 - firstDow + 7) % 7);
  const thirdFriday = firstFriday + 14;
  let expiry = new Date(year, month - 1, thirdFriday);

  // If it's a holiday, go to previous business day
  const holidays = getBankHolidays(year);
  while (expiry.getDay() === 0 || expiry.getDay() === 6 || holidays.has(formatDateKey(expiry))) {
    expiry.setDate(expiry.getDate() - 1);
  }
  return expiry;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function getExpiryOptions(year?: number): { label: string; date: string; month: number }[] {
  const y = year ?? new Date().getFullYear();
  const options: { label: string; date: string; month: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const d = getThirdFriday(y, m);
    const dateStr = formatDateKey(d);
    const dayStr = `${d.getDate()}`.padStart(2, '0');
    const monthStr = `${d.getMonth() + 1}`.padStart(2, '0');
    options.push({
      label: `${MONTH_NAMES[m - 1]} ${y} (${dayStr}/${monthStr})`,
      date: dateStr,
      month: m,
    });
  }
  return options;
}

// Keep backwards compat
export const EXPIRY_OPTIONS = getExpiryOptions();

export function getOptionTypeFromLetter(letter: string): 'call' | 'put' | null {
  const upper = letter.toUpperCase();
  if (CALL_LETTERS.includes(upper)) return 'call';
  if (PUT_LETTERS.includes(upper)) return 'put';
  return null;
}

export function getMonthFromLetter(letter: string): number | null {
  const upper = letter.toUpperCase();
  const callIdx = CALL_LETTERS.indexOf(upper);
  if (callIdx >= 0) return callIdx + 1;
  const putIdx = PUT_LETTERS.indexOf(upper);
  if (putIdx >= 0) return putIdx + 1;
  return null;
}

export function getExpiryFromTicker(ticker: string): Date | null {
  if (!ticker || ticker.length < 5) return null;
  const letter = ticker[4].toUpperCase();
  const month = getMonthFromLetter(letter);
  if (!month) return null;

  // Use current year, but if the expiry month already passed, use next year
  const now = new Date();
  let year = now.getFullYear();
  const expiry = getThirdFriday(year, month);
  if (expiry < now) {
    year += 1;
    return getThirdFriday(year, month);
  }
  return expiry;
}

export function countBusinessDays(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (end <= start) return 0;

  // Collect holidays for all years in range
  const holidays = new Set<string>();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    for (const h of getBankHolidays(y)) {
      holidays.add(h);
    }
  }

  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6 && !holidays.has(formatDateKey(current))) {
      count += 1;
    }
  }
  return count;
}

export function getUnderlyingRoot(ticker: string): string {
  if (!ticker) return '';
  return ticker.slice(0, 4).toUpperCase();
}
