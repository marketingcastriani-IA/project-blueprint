import { describe, it, expect } from "vitest";
import { detectStrategy } from "../lib/strategies";
import { calculatePayoffAtExpiry, calculateMetrics } from "../lib/payoff";
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

  it("should detect Collar with different expiry months (calendar collar)", () => {
    // Structure from user: Sell Call D(Apr) + Buy Stock + Buy Put R(Jun)
    const legs: Leg[] = [
      { side: "sell", option_type: "call", asset: "PETRD474", strike: 47.40, price: 1.76, quantity: 100 },
      { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 45.71, quantity: 100 },
      { side: "buy", option_type: "put", asset: "PETRR484", strike: 48.48, price: 3.31, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).not.toBeNull();
    expect(strategy?.type).toBe("Collar");

    // montageTotal = (45.71 + 3.31 - 1.76) * 100 = 47.26 * 100 = 4726
    expect(strategy?.montageTotal).toBe(4726.00);
    // breakeven = 4726 / 100 = 47.26
    expect(strategy?.breakeven).toBe(47.26);

    // At call strike (47.40): profit = (47.40 - 47.26) * 100 = 14
    // At put strike (48.48): profit = (48.48 - 47.26) * 100 = 122
    // Max profit = 122 (at put strike, since put > call)
    expect(strategy?.maxProfit).toBe(122.00);
    // Min profit = 14 (at call strike) - risk free!
    expect(strategy?.maxLoss).toBe(14.00);
    expect(strategy?.isRiskFree).toBe(true);
  });
});

describe("calculatePayoffAtExpiry - Collar structure", () => {
  const legs: Leg[] = [
    { side: "sell", option_type: "call", asset: "PETRD474", strike: 47.40, price: 1.76, quantity: 100 },
    { side: "buy", option_type: "stock", asset: "PETR4", strike: 0, price: 45.71, quantity: 100 },
    { side: "buy", option_type: "put", asset: "PETRR484", strike: 48.48, price: 3.31, quantity: 100 },
  ];

  it("should calculate correct payoff when price is below put strike", () => {
    // At price 40: stock=-571, call=+176, put=(48.48-40-3.31)*100=517 → total=122
    const payoff = calculatePayoffAtExpiry(legs, 40);
    expect(payoff).toBeCloseTo(122, 0);
  });

  it("should calculate correct payoff at current stock price (45.71)", () => {
    const payoff = calculatePayoffAtExpiry(legs, 45.71);
    // Stock: 0, Call: +176 (OTM), Put: (48.48-45.71-3.31)*100 = -54 → total = 122
    expect(payoff).toBeCloseTo(122, 0);
  });

  it("should calculate correct payoff at call strike (47.40)", () => {
    // Stock: (47.40-45.71)*100=169, Call: +176-0=176 (ATM), Put: (48.48-47.40-3.31)*100=-223*... 
    // Actually: stock=169, call sell=176(premium, 0 intrinsic), put buy=(1.08-3.31)*100=-223
    // Wait, let me recalc properly
    // Stock buy: (47.40 - 45.71) * 100 = 169
    // Sell call: -(max(0, 47.40-47.40) - 1.76) * 100 = -(-1.76)*100 = 176
    // Buy put: (max(0, 48.48-47.40) - 3.31) * 100 = (1.08 - 3.31)*100 = -223
    // Total = 169 + 176 - 223 = 122... hmm wait
    // Actually: multiplier for sell = -1
    // sell call: -1 * (max(0, 47.40-47.40) - 1.76) * 100 = -1 * (-1.76) * 100 = 176
    // buy put: 1 * (max(0, 48.48-47.40) - 3.31) * 100 = 1 * (1.08-3.31) * 100 = -223
    // buy stock: 1 * (47.40 - 45.71) * 100 = 169
    // Total = 176 - 223 + 169 = 122
    const payoff = calculatePayoffAtExpiry(legs, 47.40);
    expect(payoff).toBeCloseTo(122, 0);
  });

  it("should calculate correct payoff between strikes (48.00)", () => {
    // Stock: (48-45.71)*100=229, Sell call: -1*(48-47.40-1.76)*100=-1*(-1.16)*100=116
    // Buy put: (48.48-48-3.31)*100=(-2.83)*100=-283
    // Total = 229 + 116 - 283 = 62
    const payoff = calculatePayoffAtExpiry(legs, 48.00);
    expect(payoff).toBeCloseTo(62, 0);
  });

  it("should calculate correct payoff above put strike (55)", () => {
    // Stock: (55-45.71)*100=929, Sell call: -1*(55-47.40-1.76)*100=-1*(5.84)*100=-584
    // Buy put: (0-3.31)*100=-331
    // Total = 929 - 584 - 331 = 14
    const payoff = calculatePayoffAtExpiry(legs, 55);
    expect(payoff).toBeCloseTo(14, 0);
  });
});
