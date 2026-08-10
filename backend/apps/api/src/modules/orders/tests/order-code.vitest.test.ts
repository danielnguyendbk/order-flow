import { describe, expect, it } from "vitest";

import { generatePaymentCode } from "../order-code";

describe("generatePaymentCode", () => {
  it("fits the SePay PAY prefix plus ten-digit suffix structure", () => {
    expect(generatePaymentCode("ORD-20260810-3956")).toBe("PAY2608103956");
  });

  it("normalizes fallback order codes and never exceeds thirteen characters", () => {
    const paymentCode = generatePaymentCode("order-special-abc1234567890");

    expect(paymentCode).toBe("PAY1234567890");
    expect(paymentCode).toMatch(/^PAY[A-Z0-9]{1,10}$/);
  });

  it("rejects an order code without letters or numbers", () => {
    expect(() => generatePaymentCode("---")).toThrow("empty order code");
  });
});
