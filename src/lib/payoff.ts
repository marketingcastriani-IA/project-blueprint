import { Leg, PayoffPoint, AnalysisMetrics } from './types';
import { detectStrategy } from './strategies';

/**
 * Calcula o payoff no vencimento para um dado preço spot.
 *
 * Para ATIVO (stock):
 *   - O lucro/prejuízo é: (spotPrice - preçoDeCompra) × quantidade × sinal
 *   - O campo `price` armazena o preço de compra do ativo.
 *   - O campo `strike` é irrelevante para ativo; usamos `price` como custo base.
 *
 * Para CALL/PUT:
 *   - O lucro/prejuízo é: (valorIntrínseco - prêmioPago) × quantidade × sinal
 *   - Comprador (buy): paga o prêmio, recebe o valor intrínseco.
 *   - Vendedor (sell): recebe o prêmio, paga o valor intrínseco.
 */
export function calculatePayoffAtExpiry(legs: Leg[], spotPrice: number): number {
  let total = 0;
  for (const leg of legs) {
    const multiplier = leg.side === 'buy' ? 1 : -1;

    if (leg.option_type === 'stock') {
      // Ativo: lucro = (spot - preço_de_compra) × qty para comprador
      // O `price` é o preço de aquisição do ativo
      total += multiplier * (spotPrice - leg.price) * leg.quantity;
    } else if (leg.option_type === 'call') {
      const intrinsic = Math.max(0, spotPrice - leg.strike);
      // Comprador de call: recebe intrínseco, pagou prêmio → lucro = intrínseco - prêmio
      // Vendedor de call: recebeu prêmio, paga intrínseco → lucro = prêmio - intrínseco
      total += multiplier * (intrinsic - leg.price) * leg.quantity;
    } else {
      // put
      const intrinsic = Math.max(0, leg.strike - spotPrice);
      total += multiplier * (intrinsic - leg.price) * leg.quantity;
    }
  }
  return total;
}

/**
 * Gera a curva de payoff com uma faixa de preços adequada.
 *
 * A faixa é calculada com base nos strikes das opções e no preço do ativo,
 * garantindo que o gráfico mostre a forma completa do payoff (incluindo
 * regiões de lucro e prejuízo).
 */
export function generatePayoffCurve(legs: Leg[], numPoints = 200): PayoffPoint[] {
  if (legs.length === 0) return [];

  // Coletar todos os preços de referência: strikes de opções + preços de ativos
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

  // Padding de 40% para cada lado, garantindo boa visualização
  const padding = Math.max(range * 0.4, maxRef * 0.15);
  const start = Math.max(0.01, minRef - padding);
  const end = maxRef + padding;
  const step = (end - start) / numPoints;

  const points: PayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const price = start + step * i;
    points.push({
      price: Math.round(price * 100) / 100,
      profitAtExpiry: Math.round(calculatePayoffAtExpiry(legs, price) * 100) / 100,
      profitToday: 0,
    });
  }
  return points;
}

/**
 * Calcula as métricas da estrutura: lucro máximo, risco máximo, breakevens e custo líquido.
 *
 * Custo líquido:
 *   - Para cada perna: comprador paga (negativo para o caixa), vendedor recebe (positivo).
 *   - netCost > 0: estrutura geradora de crédito (recebemos dinheiro).
 *   - netCost < 0: estrutura devedora de débito (pagamos dinheiro).
 */
export function calculateMetrics(legs: Leg[]): AnalysisMetrics {
  if (legs.length === 0) return { maxGain: 0, maxLoss: 0, breakevens: [], netCost: 0 };

  const curve = generatePayoffCurve(legs, 2000);
  const profits = curve.map(p => p.profitAtExpiry);
  const maxProfit = Math.max(...profits);
  const minProfit = Math.min(...profits);

  // Detectar breakevens por cruzamento de zero
  const breakevens: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1].profitAtExpiry;
    const curr = curve[i].profitAtExpiry;
    if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
      // Interpolação linear para encontrar o ponto exato
      const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
      const be = curve[i - 1].price + ratio * (curve[i].price - curve[i - 1].price);
      // Evitar duplicatas próximas
      const isDuplicate = breakevens.some(b => Math.abs(b - be) < 0.05);
      if (!isDuplicate) {
        breakevens.push(Math.round(be * 100) / 100);
      }
    }
  }

  // Custo líquido da estrutura
  // Comprador paga prêmio (saída de caixa = negativo)
  // Vendedor recebe prêmio (entrada de caixa = positivo)
  let netCost = 0;
  for (const leg of legs) {
    if (leg.option_type === 'stock') {
      // Para ativo, o custo é o preço de compra (sempre débito para comprador)
      const multiplier = leg.side === 'buy' ? -1 : 1;
      netCost += multiplier * leg.price * leg.quantity;
    } else {
      const multiplier = leg.side === 'buy' ? -1 : 1;
      netCost += multiplier * leg.price * leg.quantity;
    }
  }

  // Verificar se ganho/perda são ilimitados
  // Uma estrutura tem ganho ilimitado se o payoff continua crescendo nos extremos
  const lastProfit = profits[profits.length - 1];
  const firstProfit = profits[0];
  const secondLastProfit = profits[profits.length - 2];
  const secondProfit = profits[1];

  // Ganho ilimitado: payoff crescente no extremo direito ou esquerdo
  const isGainUnlimitedRight = lastProfit > secondLastProfit && lastProfit > 0 && maxProfit === lastProfit;
  const isGainUnlimitedLeft = firstProfit > secondProfit && firstProfit > 0 && maxProfit === firstProfit;
  const isGainUnlimited = isGainUnlimitedRight || isGainUnlimitedLeft;

  // Perda ilimitada: payoff decrescente no extremo direito ou esquerdo (valores negativos)
  const isLossUnlimitedRight = lastProfit < secondLastProfit && lastProfit < 0 && minProfit === lastProfit;
  const isLossUnlimitedLeft = firstProfit < secondProfit && firstProfit < 0 && minProfit === firstProfit;
  const isLossUnlimited = isLossUnlimitedRight || isLossUnlimitedLeft;

  const result: AnalysisMetrics = {
    maxGain: isGainUnlimited ? 'Ilimitado' : Math.round(maxProfit * 100) / 100,
    maxLoss: isLossUnlimited ? 'Ilimitado' : Math.round(minProfit * 100) / 100,
    breakevens,
    netCost: Math.round(netCost * 100) / 100,
  };

  // Enriquecer com detecção de estratégia (Collar, etc.)
  const strategy = detectStrategy(legs);
  if (strategy) {
    result.strategyType = strategy.type;
    result.strategyLabel = strategy.label;
    result.montageTotal = strategy.montageTotal;
    result.realBreakeven = strategy.breakeven;
    result.isRiskFree = strategy.isRiskFree;
    result.maxGain = strategy.maxProfit;
    result.maxLoss = strategy.isRiskFree ? 0 : (typeof strategy.maxLoss === 'number' ? -Math.abs(strategy.maxLoss) : strategy.maxLoss);
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
