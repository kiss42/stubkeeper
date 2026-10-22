import { describe, expect, it } from "vitest";
import { addToYtd, calculatePay, ZERO_YTD } from "./payroll";

const base = {
  preTaxCents: 0,
  postTaxCents: 0,
  frequency: "biweekly" as const,
  filingStatus: "single" as const,
  stateRate: 0,
  ytdBefore: ZERO_YTD,
};

describe("calculatePay", () => {
  it("withholds FICA at statutory rates", () => {
    const r = calculatePay({ ...base, grossCents: 200000 });
    expect(r.socialSecurityCents).toBe(12400);
    expect(r.medicareCents).toBe(2900);
  });

  it("net pay reconciles to the cent", () => {
    const r = calculatePay({ ...base, grossCents: 250000, preTaxCents: 10000, postTaxCents: 5000, stateRate: 0.04 });
    const sum = r.federalCents + r.socialSecurityCents + r.medicareCents + r.stateCents + r.preTaxCents + r.postTaxCents;
    expect(r.netCents).toBe(r.grossCents - sum);
  });

  it("caps Social Security at the wage base", () => {
    const r = calculatePay({
      ...base,
      grossCents: 500000,
      ytdBefore: { ...ZERO_YTD, gross: 17_600_000 },
    });
    expect(r.socialSecurityCents).toBe(Math.round(10000 * 0.062));
  });

  it("owes no federal tax below the standard deduction", () => {
    const r = calculatePay({ ...base, grossCents: 50000 });
    expect(r.federalCents).toBe(0);
  });

  it("rejects pre-tax deductions above gross", () => {
    expect(() => calculatePay({ ...base, grossCents: 1000, preTaxCents: 2000 })).toThrow();
  });
});

describe("addToYtd", () => {
  it("accumulates across pay runs", () => {
    const a = calculatePay({ ...base, grossCents: 200000 });
    const y = addToYtd(addToYtd(ZERO_YTD, a), a);
    expect(y.gross).toBe(400000);
    expect(y.net).toBe(a.netCents * 2);
  });
});
