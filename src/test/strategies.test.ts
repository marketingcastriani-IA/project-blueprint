import { describe, it, expect } from "vitest";
import { detectStrategy } from "../lib/strategies";
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
    expect(strategy?.montageTotal).toBe(100.00); // (1.50 - 0.50) * 100
    expect(strategy?.breakeven).toBe(31.00); // 30 + (100/100)
    expect(strategy?.maxProfit).toBe(100.00); // (32 - 30 - 1) * 100
    expect(strategy?.maxLoss).toBe(100.00); // (1.50 - 0.50) * 100
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
    expect(strategy?.montageTotal).toBe(40.00); // (0.50 - 0.10) * 100
    expect(strategy?.breakeven).toBe(29.60); // 30 - (40/100)
    expect(strategy?.maxProfit).toBe(160.00); // (30 - 28 - 0.40) * 100
    expect(strategy?.maxLoss).toBe(40.00); // (0.50 - 0.10) * 100
    expect(strategy?.isRiskFree).toBe(false);
  });

  it("should return null if no strategy is detected", () => {
    const legs: Leg[] = [
      { side: "buy", option_type: "call", asset: "PETRD30", strike: 30, price: 1.50, quantity: 100 },
    ];
    const strategy = detectStrategy(legs);
    expect(strategy).toBeNull();
  });
});
