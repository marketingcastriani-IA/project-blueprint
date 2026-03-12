import { describe, it, expect } from "vitest";
import { detectStrategy } from "../lib/strategies";
import { calculatePayoffAtExpiry, calculatePayoffAtCutoff, calculateMetrics } from "../lib/payoff";
import { Leg } from "../lib/types";

describe("detectStrategy", () => {
  it("should detect Covered Call and calculate metrics correctly", () => {
    const legs: Leg[] = [
      { side: "sell", option_type: "call", asset: "PETRC405", strike: 39.65, price: 0.80, quantity: 100 },
      { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 39.61, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).not.toBeNull();
    expect(strategy?.type).toBe("CoveredCall");
    expect(strategy?.label).toBe("Op. Compra Coberta");
    expect(strategy?.montageTotal).toBe(3881.00);
    expect(strategy?.breakeven).toBe(38.81);
    expect(strategy?.maxProfit).toBe(84.00);
    expect(strategy?.maxLoss).toBe(3881.00);
    expect(strategy?.isRiskFree).toBe(false);
  });

  it("should detect Bull Call Spread and calculate metrics correctly", () => {
    const legs: Leg[] = [
      { side: "buy", option_type: "call", asset: "PETRD30", strike: 30, price: 1.50, quantity: 100 },
      { side: "sell", option_type: "call", asset: "PETRD32", strike: 32, price: 0.50, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).not.toBeNull();
    expect(strategy?.type).toBe("BullCallSpread");
    expect(strategy?.label).toBe("Trava de Alta com Call");
    expect(strategy?.montageTotal).toBe(100.00);
    expect(strategy?.breakeven).toBe(31.00);
    expect(strategy?.maxProfit).toBe(100.00);
    expect(strategy?.maxLoss).toBe(100.00);
    expect(strategy?.isRiskFree).toBe(false);
  });

  it("should detect Bear Put Spread and calculate metrics correctly", () => {
    const legs: Leg[] = [
      { side: "buy", option_type: "put", asset: "PETRE30", strike: 30, price: 0.50, quantity: 100 },
      { side: "sell", option_type: "put", asset: "PETRE28", strike: 28, price: 0.10, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).not.toBeNull();
    expect(strategy?.type).toBe("BearPutSpread");
    expect(strategy?.label).toBe("Trava de Baixa com Put");
    expect(strategy?.montageTotal).toBe(40.00);
    expect(strategy?.breakeven).toBe(29.60);
    expect(strategy?.maxProfit).toBe(160.00);
    expect(strategy?.maxLoss).toBe(40.00);
    expect(strategy?.isRiskFree).toBe(false);
  });

  it("should return null if no strategy is detected", () => {
    const legs: Leg[] = [
      { side: "buy", option_type: "call", asset: "PETRD30", strike: 30, price: 1.50, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).toBeNull();
  });

  it("should detect Calendar Collar with different expiry months", () => {
    const legs: Leg[] = [
      { side: "sell", option_type: "call", asset: "PETRD474", strike: 47.40, price: 1.76, quantity: 100 },
      { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 45.71, quantity: 100 },
      { side: "buy", option_type: "put", asset: "PETRR484", strike: 48.48, price: 3.31, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).not.toBeNull();
    expect(strategy?.type).toBe("CalendarCollar");
    expect(strategy?.label).toBe("Collar Calendário (Calendar Spread)");
    expect(strategy?.montageTotal).toBe(4726.00);
    expect(strategy?.breakeven).toBe(47.26);
    expect(strategy?.isRiskFree).toBe(true);
  });

  it("should detect standard Collar with same expiry month", () => {
    const legs: Leg[] = [
      { side: "sell", option_type: "call", asset: "PETRD474", strike: 47.40, price: 1.76, quantity: 100 },
      { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 45.71, quantity: 100 },
      { side: "buy", option_type: "put", asset: "PETRD484", strike: 48.48, price: 3.31, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).not.toBeNull();
    expect(strategy?.type).toBe("Collar");
    expect(strategy?.label).toBe("Collar (Financiamento com Proteção)");
  });
});

describe("calculatePayoffAtExpiry - Collar structure", () => {
  const legs: Leg[] = [
    { side: "sell", option_type: "call", asset: "PETRD474", strike: 47.40, price: 1.76, quantity: 100 },
    { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 45.71, quantity: 100 },
    { side: "buy", option_type: "put", asset: "PETRR484", strike: 48.48, price: 3.31, quantity: 100 },
  ];

  it("should calculate correct payoff when price is below put strike", () => {
    const payoff = calculatePayoffAtExpiry(legs, 40);
    expect(payoff).toBeCloseTo(122, 0);
  });

  it("should calculate correct payoff at current stock price (45.71)", () => {
    const payoff = calculatePayoffAtExpiry(legs, 45.71);
    expect(payoff).toBeCloseTo(122, 0);
  });

  it("should calculate correct payoff at call strike (47.40)", () => {
    const payoff = calculatePayoffAtExpiry(legs, 47.40);
    expect(payoff).toBeCloseTo(122, 0);
  });

  it("should calculate correct payoff between strikes (48.00)", () => {
    const payoff = calculatePayoffAtExpiry(legs, 48.00);
    expect(payoff).toBeCloseTo(62, 0);
  });

  it("should calculate correct payoff above put strike (55)", () => {
    const payoff = calculatePayoffAtExpiry(legs, 55);
    expect(payoff).toBeCloseTo(14, 0);
  });
});

describe("calculatePayoffAtCutoff - Calendar Collar with BS", () => {
  // Calendar Collar: Call expires April, Put expires June
  // At the Call's expiry, the Put still has ~42 business days of time value
  const legs: Leg[] = [
    { side: "sell", option_type: "call", asset: "PETRD474", strike: 47.40, price: 1.76, quantity: 100, expiry_date: "2026-04-17" },
    { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 45.71, quantity: 100 },
    { side: "buy", option_type: "put", asset: "PETRR484", strike: 48.48, price: 3.31, quantity: 100, expiry_date: "2026-06-19" },
  ];

  it("should give higher max profit than intrinsic-only calculation due to time value", () => {
    // With BS, the put has time value at the call's expiry, increasing the peak profit
    const legRemainingDays = new Map<number, number>();
    legRemainingDays.set(0, 0);  // call expires at cutoff
    legRemainingDays.set(1, 0);  // stock, no expiry
    legRemainingDays.set(2, 42); // put has ~42 business days remaining

    // At spot = 45.71 (near the peak), BS put value should be higher than intrinsic
    const bsPayoff = calculatePayoffAtCutoff(legs, 45.71, legRemainingDays, 14.90, 0.35);
    const intrinsicPayoff = calculatePayoffAtExpiry(legs, 45.71);

    // The BS payoff should be higher because the put still has time value
    expect(bsPayoff).toBeGreaterThan(intrinsicPayoff);
  });

  it("should produce a bell-shaped curve peaking near 45-47 range", () => {
    const legRemainingDays = new Map<number, number>();
    legRemainingDays.set(0, 0);
    legRemainingDays.set(1, 0);
    legRemainingDays.set(2, 42);

    const payoffAt30 = calculatePayoffAtCutoff(legs, 30, legRemainingDays, 14.90, 0.35);
    const payoffAt45 = calculatePayoffAtCutoff(legs, 45, legRemainingDays, 14.90, 0.35);
    const payoffAt60 = calculatePayoffAtCutoff(legs, 60, legRemainingDays, 14.90, 0.35);

    // Peak should be around 45-47, extremes should be lower
    expect(payoffAt45).toBeGreaterThan(payoffAt30);
    expect(payoffAt45).toBeGreaterThan(payoffAt60);
  });
});
