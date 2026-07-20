import { describe, it, expect } from "vitest";
import {
  calculatePayoffAtExpiry,
  calculateMetrics,
  generatePayoffCurve,
  calculateCDIReturn,
  calculateCDIOpportunityCost,
} from "../lib/payoff";
import { Leg } from "../lib/types";

const longCall = (strike: number, price: number, quantity = 100): Leg => ({
  side: "buy", option_type: "call", asset: "TESTC", strike, price, quantity,
});
const shortCall = (strike: number, price: number, quantity = 100): Leg => ({
  side: "sell", option_type: "call", asset: "TESTC", strike, price, quantity,
});
const longPut = (strike: number, price: number, quantity = 100): Leg => ({
  side: "buy", option_type: "put", asset: "TESTP", strike, price, quantity,
});

describe("calculatePayoffAtExpiry", () => {
  it("long call: perde o prêmio abaixo do strike, ganha intrínseco acima", () => {
    const legs = [longCall(30, 1.5)];
    expect(calculatePayoffAtExpiry(legs, 25)).toBeCloseTo(-150, 2);
    expect(calculatePayoffAtExpiry(legs, 30)).toBeCloseTo(-150, 2);
    expect(calculatePayoffAtExpiry(legs, 35)).toBeCloseTo((5 - 1.5) * 100, 2);
  });

  it("short put: ganha o prêmio acima do strike, perde intrínseco abaixo", () => {
    const legs: Leg[] = [{ side: "sell", option_type: "put", asset: "TESTP", strike: 30, price: 2, quantity: 100 }];
    expect(calculatePayoffAtExpiry(legs, 35)).toBeCloseTo(200, 2);
    expect(calculatePayoffAtExpiry(legs, 25)).toBeCloseTo(-(5 - 2) * 100, 2);
  });

  it("perna de ação segue o preço linearmente", () => {
    const legs: Leg[] = [{ side: "buy", option_type: "stock", asset: "TEST3", strike: 0, price: 40, quantity: 100 }];
    expect(calculatePayoffAtExpiry(legs, 42)).toBeCloseTo(200, 2);
    expect(calculatePayoffAtExpiry(legs, 38)).toBeCloseTo(-200, 2);
  });

  it("trava de alta (bull call spread) limita ganho e perda", () => {
    const legs = [longCall(30, 1.5), shortCall(32, 0.5)];
    expect(calculatePayoffAtExpiry(legs, 28)).toBeCloseTo(-100, 2); // perde prêmio líquido
    expect(calculatePayoffAtExpiry(legs, 31)).toBeCloseTo(0, 2);    // breakeven em 31
    expect(calculatePayoffAtExpiry(legs, 40)).toBeCloseTo(100, 2);  // ganho máximo (2 - 1) * 100
  });
});

describe("calculateMetrics", () => {
  it("retorna zeros para lista vazia", () => {
    expect(calculateMetrics([])).toEqual({ maxGain: 0, maxLoss: 0, breakevens: [], netCost: 0 });
  });

  it("trava de alta: ganho/perda limitados e breakeven correto", () => {
    const m = calculateMetrics([longCall(30, 1.5), shortCall(32, 0.5)]);
    expect(m.maxGain).toBeCloseTo(100, 0);
    expect(typeof m.maxLoss).toBe("number");
    expect(m.maxLoss as number).toBeLessThanOrEqual(-99);
    expect(m.breakevens).toContain(31);
    expect(m.netCost).toBeCloseTo(-100, 2); // desembolso líquido de R$ 100
  });

  it("straddle comprado: ganho ilimitado e dois breakevens", () => {
    const m = calculateMetrics([longCall(30, 1.5), longPut(30, 1.5)]);
    expect(m.maxGain).toBe("Ilimitado");
    expect(m.breakevens.length).toBeGreaterThanOrEqual(2);
    expect(m.breakevens[0]).toBeCloseTo(27, 0);
    expect(m.breakevens[m.breakevens.length - 1]).toBeCloseTo(33, 0);
  });

  it("call vendida a descoberto: perda ilimitada", () => {
    const m = calculateMetrics([shortCall(30, 2)]);
    expect(m.maxLoss).toBe("Ilimitado");
  });
});

describe("generatePayoffCurve", () => {
  it("gera numPoints + 1 pontos, em ordem crescente de preço", () => {
    const curve = generatePayoffCurve([longCall(30, 1.5)], 0, 14.9, 50);
    expect(curve.length).toBe(51);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].price).toBeGreaterThan(curve[i - 1].price);
    }
  });
});

describe("calculateCDIReturn", () => {
  it("252 dias úteis a 12% rende exatamente 12% sem IR", () => {
    expect(calculateCDIReturn(1000, 12, 252, false)).toBeCloseTo(120, 2);
  });

  it("aplica IR de 20% na faixa 181-360 dias", () => {
    expect(calculateCDIReturn(1000, 12, 252, true)).toBeCloseTo(96, 2);
  });

  it("entradas inválidas retornam 0", () => {
    expect(calculateCDIReturn(0, 12, 100, false)).toBe(0);
    expect(calculateCDIReturn(1000, 0, 100, false)).toBe(0);
    expect(calculateCDIReturn(1000, 12, 0, false)).toBe(0);
  });
});

describe("calculateCDIOpportunityCost", () => {
  it("252 dias úteis equivalem à taxa anual cheia", () => {
    expect(calculateCDIOpportunityCost(1000, 10, 252)).toBeCloseTo(100, 2);
  });

  it("entradas inválidas retornam 0", () => {
    expect(calculateCDIOpportunityCost(0, 10, 10)).toBe(0);
  });
});
