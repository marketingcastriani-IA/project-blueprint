import { Leg, PayoffPoint, AnalysisMetrics } from './types';
import { detectStrategy } from './strategies';
import { countBusinessDays } from './b3-calendar';

/**
 * Black-Scholes mathematical helpers
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return x > 0 ? 1 - p : p;
}

export function calculateOptionPrice(
  type: 'call' | 'put',
  S: number,
  K: number,
  T: number,
  r: number,
  v: number
): number {
  if (T <= 0.001) return type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);

  const d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);

  if (type === 'call') {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

/**
 * Calcula o payoff no vencimento para um dado preço spot (todas as pernas vencem juntas).
 */
export function calculatePayoffAtExpiry(legs: Leg[], spotPrice: number): number {
  let total = 0;
  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? 1 : -1;

    if (leg.option_type === 'stock') {
      total += multiplier * (spotPrice - leg.price) * leg.quantity;
    } else if (leg.option_type === 'call') {
      const intrinsic = Math.max(0, spotPrice - leg.strike);
      total += multiplier * (intrinsic - leg.price) * leg.quantity;
    } else {
      const intrinsic = Math.max(0, leg.strike - spotPrice);
      total += multiplier * (intrinsic - leg.price) * leg.quantity;
    }
  }
  return total;
}

/**
 * Determina se a estrutura tem vencimentos múltiplos (calendar spread).
 * Retorna a data de corte (vencimento mais curto) e os dias úteis restantes de cada perna.
 */
function getMultiMaturityInfo(legs: Leg[]): {
  isMultiMaturity: boolean;
  cutoffDate: Date | null;
  legRemainingDays: Map<number, number>; // index -> business days remaining after cutoff
} {
  const expiryDates: Date[] = [];
  const legDates: (Date | null)[] = [];

  for (const leg of legs) {
    if (leg.option_type === 'stock') {
      legDates.push(null); // stock has no expiry
      continue;
    }
    if (leg.expiry_date) {
      const d = new Date(leg.expiry_date + 'T12:00:00');
      legDates.push(d);
      expiryDates.push(d);
    } else {
      legDates.push(null);
    }
  }

  if (expiryDates.length < 2) {
    return { isMultiMaturity: false, cutoffDate: null, legRemainingDays: new Map() };
  }

  // Find earliest expiry
  const sorted = [...expiryDates].sort((a, b) => a.getTime() - b.getTime());
  const cutoffDate = sorted[0];
  const latestDate = sorted[sorted.length - 1];

  // Check if they're actually different
  if (cutoffDate.getTime() === latestDate.getTime()) {
    return { isMultiMaturity: false, cutoffDate: null, legRemainingDays: new Map() };
  }

  const legRemainingDays = new Map<number, number>();
  for (let i = 0; i < legs.length; i++) {
    const d = legDates[i];
    if (d && d.getTime() > cutoffDate.getTime()) {
      legRemainingDays.set(i, countBusinessDays(cutoffDate, d));
    } else {
      legRemainingDays.set(i, 0); // expires at cutoff or is stock
    }
  }

  return { isMultiMaturity: true, cutoffDate, legRemainingDays };
}

/**
 * Calcula o payoff na data de corte (vencimento mais curto) para calendar spreads.
 * Pernas que vencem na data de corte: valor intrínseco.
 * Pernas que vencem depois: valor Black-Scholes (com tempo restante).
 */
export function calculatePayoffAtCutoff(
  legs: Leg[],
  spotPrice: number,
  legRemainingDays: Map<number, number>,
  cdiRate: number = 14.90,
  volatility: number = 0.35
): number {
  let total = 0;
  const r = cdiRate / 100;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const multiplier = leg.side === 'buy' ? 1 : -1;
    const remainingDays = legRemainingDays.get(i) ?? 0;

    if (leg.option_type === 'stock') {
      total += multiplier * (spotPrice - leg.price) * leg.quantity;
    } else if (remainingDays <= 0) {
      // This leg expires at cutoff → intrinsic value
      const intrinsic = leg.option_type === 'call'
        ? Math.max(0, spotPrice - leg.strike)
        : Math.max(0, leg.strike - spotPrice);
      total += multiplier * (intrinsic - leg.price) * leg.quantity;
    } else {
      // This leg still has time → Black-Scholes value
      const T = remainingDays / 252;
      const bsValue = calculateOptionPrice(
        leg.option_type as 'call' | 'put',
        spotPrice,
        leg.strike,
        T,
        r,
        volatility
      );
      total += multiplier * (bsValue - leg.price) * leg.quantity;
    }
  }
  return total;
}

/**
 * Calcula o payoff estimado para HOJE (T+0) usando Black-Scholes.
 */
export function calculatePayoffToday(legs: Leg[], spotPrice: number, daysToExpiry: number, cdiRate: number): number {
  let total = 0;
  const T = daysToExpiry / 252;
  const r = cdiRate / 100;
  const v = 0.35;

  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? 1 : -1;

    if (leg.option_type === 'stock') {
      total += multiplier * (spotPrice - leg.price) * leg.quantity;
    } else {
      const currentOptionValue = calculateOptionPrice(
        leg.option_type as 'call' | 'put',
        spotPrice,
        leg.strike,
        T,
        r,
        v
      );
      total += multiplier * (currentOptionValue - leg.price) * leg.quantity;
    }
  }
  return total;
}

/**
 * Gera a curva de payoff com uma faixa de preços adequada.
 * Detecta automaticamente calendar spreads e usa BS para pernas com vencimento futuro.
 */
export function generatePayoffCurve(legs: Leg[], daysToExpiry = 0, cdiRate = 14.90, numPoints = 200): PayoffPoint[] {
  if (legs.length === 0) return [];

  const referencePoints: number[] = [];
  for (const leg of legs) {
    if (leg.option_type === 'stock') {
      if (leg.price > 0) referencePoints.push(leg.price);
    } else {
      if (leg.strike > 0) referencePoints.push(leg.strike);
    }
  }

  if (referencePoints.length === 0) return [];

  const minRef = Math.min(...referencePoints);
  const maxRef = Math.max(...referencePoints);
  const range = maxRef - minRef || maxRef * 0.2;

  const padding = Math.max(range * 1.5, maxRef * 0.5);
  const start = Math.max(0, minRef - padding);
  const end = maxRef + padding;
  const step = (end - start) / numPoints;

  // Check for multi-maturity (calendar spread)
  const { isMultiMaturity, legRemainingDays } = getMultiMaturityInfo(legs);

  const points: PayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const price = start + step * i;

    let profitAtExpiry: number;
    if (isMultiMaturity) {
      // Calendar spread: use BS for longer-dated legs at the cutoff date
      profitAtExpiry = calculatePayoffAtCutoff(legs, price, legRemainingDays, cdiRate);
    } else {
      profitAtExpiry = calculatePayoffAtExpiry(legs, price);
    }

    points.push({
      price: Math.round(price * 100) / 100,
      profitAtExpiry: Math.round(profitAtExpiry * 100) / 100,
      profitToday: Math.round(calculatePayoffToday(legs, price, daysToExpiry, cdiRate) * 100) / 100,
    });
  }
  return points;
}

/**
 * Calcula as métricas da estrutura.
 */
export function calculateMetrics(legs: Leg[]): AnalysisMetrics {
  if (legs.length === 0) return { maxGain: 0, maxLoss: 0, breakevens: [], netCost: 0 };

  const { isMultiMaturity, legRemainingDays } = getMultiMaturityInfo(legs);

  // Geramos uma curva ampla para análise de limites
  const curve = generatePayoffCurve(legs, 0, 14.90, 1000);
  const profits = curve.map(p => p.profitAtExpiry);
  const maxProfit = Math.max(...profits);
  const minProfit = Math.min(...profits);

  const breakevens: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].profitAtExpiry;
    const curr = curve[i].profitAtExpiry;
    if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
      const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
      const be = curve[i - 1].price + ratio * (curve[i].price - curve[i - 1].price);
      breakevens.push(Math.round(be * 100) / 100);
    }
  }

  let netCost = 0;
  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? -1 : 1;
    netCost += multiplier * leg.price * leg.quantity;
  }

  // Detecção de lucro/prejuízo ilimitado baseada na inclinação das extremidades
  const lastProfit = profits[profits.length - 1];
  const secondLastProfit = profits[profits.length - 2];
  const firstProfit = profits[0];
  const secondProfit = profits[1];

  // For calendar spreads (bell-shaped curve), don't mark as unlimited
  const isGainUnlimited = !isMultiMaturity && lastProfit > secondLastProfit + 0.01;
  const isLossUnlimited = !isMultiMaturity && (lastProfit < secondLastProfit - 0.01);

  // Cálculo da perda máxima real
  let absoluteMinProfit = minProfit;
  if (!isMultiMaturity) {
    const lossAtZero = calculatePayoffAtExpiry(legs, 0);
    absoluteMinProfit = Math.min(minProfit, lossAtZero);
  }

  const result: AnalysisMetrics = {
    maxGain: isGainUnlimited ? 'Ilimitado' : Math.round(maxProfit * 100) / 100,
    maxLoss: isLossUnlimited ? 'Ilimitado' : Math.round(absoluteMinProfit * 100) / 100,
    breakevens: Array.from(new Set(breakevens)).sort((a, b) => a - b),
    netCost: Math.round(netCost * 100) / 100,
  };

  const strategy = detectStrategy(legs);
  if (strategy) {
    result.strategyType = strategy.type;
    result.strategyLabel = strategy.label;
    result.montageTotal = strategy.montageTotal;
    result.realBreakeven = strategy.breakeven;
    result.isRiskFree = strategy.isRiskFree;

    // For calendar spreads, use the curve-derived metrics (more accurate with BS)
    if (!isMultiMaturity) {
      if (strategy.maxProfit !== 'Ilimitado') result.maxGain = strategy.maxProfit;
      if (!isLossUnlimited) result.maxLoss = strategy.isRiskFree ? strategy.maxLoss : Math.min(result.maxLoss as number, -Math.abs(strategy.maxLoss as number));
    }
  }

  return result;
}

export function calculateCDIReturn(
  principal: number,
  cdiRate: number,
  days: number,
  withIR: boolean
): number {
  if (principal <= 0 || cdiRate <= 0 || days <= 0) return 0;
  const dailyRate = Math.pow(1 + cdiRate / 100, 1 / 252) - 1;
  const grossReturn = principal * (Math.pow(1 + dailyRate, days) - 1);
  if (!withIR) return Math.round(grossReturn * 100) / 100;

  let irRate = 0.225;
  if (days > 720) irRate = 0.15;
  else if (days > 360) irRate = 0.175;
  else if (days > 180) irRate = 0.20;

  return Math.round(grossReturn * (1 - irRate) * 100) / 100;
}

export function calculateCDIOpportunityCost(
  capital: number,
  annualRate: number,
  businessDays: number
): number {
  if (capital <= 0 || annualRate <= 0 || businessDays <= 0) return 0;
  const result = capital * (Math.pow(1 + annualRate / 100, businessDays / 252) - 1);
  return Math.round(result * 100) / 100;
}

/**
 * Calcula gregas do portfólio num dado preço spot.
 */
export function calculatePortfolioGreeks(
  legs: Leg[],
  spotPrice: number,
  daysToExpiry: number,
  cdiRate: number = 14.90,
  volatility: number = 0.35
): { delta: number; gamma: number; theta: number; vega: number } {
  let delta = 0, gamma = 0, theta = 0, vega = 0;
  const T = daysToExpiry / 252;
  const r = cdiRate / 100;
  const v = volatility;

  if (T <= 0.001) return { delta, gamma, theta, vega };

  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? 1 : -1;
    const q = leg.quantity;

    if (leg.option_type === 'stock') {
      delta += multiplier * q;
      continue;
    }

    const S = spotPrice;
    const K = leg.strike;
    const d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);
    const nd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI); // N'(d1)

    if (leg.option_type === 'call') {
      delta += multiplier * q * normalCDF(d1);
    } else {
      delta += multiplier * q * (normalCDF(d1) - 1);
    }

    gamma += multiplier * q * nd1 / (S * v * Math.sqrt(T));
    theta += multiplier * q * (-(S * nd1 * v) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * (leg.option_type === 'call' ? normalCDF(d2) : normalCDF(-d2))) / 252;
    vega += multiplier * q * S * nd1 * Math.sqrt(T) / 100;
  }

  return { delta: +delta.toFixed(4), gamma: +gamma.toFixed(4), theta: +theta.toFixed(2), vega: +vega.toFixed(2) };
}
