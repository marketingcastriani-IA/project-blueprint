import { Leg, PayoffPoint, AnalysisMetrics } from './types';
import { detectStrategy } from './strategies';

/**
 * Black-Scholes mathematical helpers for T+0 payoff
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
  return x > 0 ? 1 - p : p;
}

export function calculateOptionPrice(
  type: 'call' | 'put',
  S: number, // Spot
  K: number, // Strike
  T: number, // Time to expiry (years)
  r: number, // Risk-free rate
  v: number  // Volatility
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
 * Calcula o payoff no vencimento para um dado preço spot.
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
 * Calcula o payoff estimado para HOJE (T+0) usando Black-Scholes.
 */
export function calculatePayoffToday(legs: Leg[], spotPrice: number, daysToExpiry: number, cdiRate: number): number {
  let total = 0;
  const T = daysToExpiry / 252; // Tempo em anos (dias úteis)
  const r = cdiRate / 100;
  const v = 0.35; // Volatilidade implícita padrão (35%)

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
      // Lucro hoje = (Valor atual da opção - Preço pago/recebido) * Qtd
      total += multiplier * (currentOptionValue - leg.price) * leg.quantity;
    }
  }
  return total;
}

/**
 * Gera a curva de payoff com uma faixa de preços adequada.
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

  const padding = Math.max(range * 0.6, maxRef * 0.2);
  const start = Math.max(0.01, minRef - padding);
  const end = maxRef + padding;
  const step = (end - start) / numPoints;

  const points: PayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const price = start + step * i;
    points.push({
      price: Math.round(price * 100) / 100,
      profitAtExpiry: Math.round(calculatePayoffAtExpiry(legs, price) * 100) / 100,
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

  const curve = generatePayoffCurve(legs, 0, 14.90, 2000);
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
      const isDuplicate = breakevens.some(b => Math.abs(b - be) < 0.05);
      if (!isDuplicate) {
        breakevens.push(Math.round(be * 100) / 100);
      }
    }
  }

  let netCost = 0;
  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? -1 : 1;
    netCost += multiplier * leg.price * leg.quantity;
  }

  const lastProfit = profits[profits.length - 1];
  const firstProfit = profits[0];
  const secondLastProfit = profits[profits.length - 2];
  const secondProfit = profits[1];

  const isGainUnlimitedRight = lastProfit > secondLastProfit && lastProfit > 0 && maxProfit === lastProfit;
  const isGainUnlimitedLeft = firstProfit > secondProfit && firstProfit > 0 && maxProfit === firstProfit;
  const isGainUnlimited = isGainUnlimitedRight || isGainUnlimitedLeft;

  const isLossUnlimitedRight = lastProfit < secondLastProfit && lastProfit < 0 && minProfit === lastProfit;
  const isLossUnlimitedLeft = firstProfit < secondProfit && firstProfit < 0 && minProfit === firstProfit;
  const isLossUnlimited = isLossUnlimitedRight || isLossUnlimitedLeft;

  const result: AnalysisMetrics = {
    maxGain: isGainUnlimited ? 'Ilimitado' : Math.round(maxProfit * 100) / 100,
    maxLoss: isLossUnlimited ? 'Ilimitado' : Math.round(minProfit * 100) / 100,
    breakevens,
    netCost: Math.round(netCost * 100) / 100,
  };

  const strategy = detectStrategy(legs);
  if (strategy) {
    result.strategyType = strategy.type;
    result.strategyLabel = strategy.label;
    result.montageTotal = strategy.montageTotal;
    result.realBreakeven = strategy.breakeven;
    result.isRiskFree = strategy.isRiskFree;
    result.maxGain = strategy.maxProfit;
    // Se for risco zero, o maxLoss é na verdade o lucro mínimo garantido
    result.maxLoss = strategy.isRiskFree ? strategy.maxLoss : (typeof strategy.maxLoss === 'number' ? -Math.abs(strategy.maxLoss) : strategy.maxLoss);
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