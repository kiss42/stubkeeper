// Payroll calculation engine. Pure functions, all amounts in integer cents.
//
// IMPORTANT: tax tables are simplified estimates for recordkeeping. They use the
// annualized percentage method with the standard deduction and ignore W-4 step
// 2-4 adjustments. Verify against IRS Publication 15-T and your state's
// withholding guide for the tax year before relying on these for filings.

export type FilingStatus = "single" | "married";
export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

export interface TaxYearConfig {
  year: number;
  standardDeduction: Record<FilingStatus, number>; // dollars
  brackets: Record<FilingStatus, Array<{ upTo: number; rate: number }>>; // dollars
  socialSecurityRate: number;
  socialSecurityWageBase: number; // dollars
  medicareRate: number;
}

export const TAX_2025: TaxYearConfig = {
  year: 2025,
  standardDeduction: { single: 15000, married: 30000 },
  brackets: {
    single: [
      { upTo: 11925, rate: 0.1 },
      { upTo: 48475, rate: 0.12 },
      { upTo: 103350, rate: 0.22 },
      { upTo: 197300, rate: 0.24 },
      { upTo: 250525, rate: 0.32 },
      { upTo: 626350, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    married: [
      { upTo: 23850, rate: 0.1 },
      { upTo: 96950, rate: 0.12 },
      { upTo: 206700, rate: 0.22 },
      { upTo: 394600, rate: 0.24 },
      { upTo: 501050, rate: 0.32 },
      { upTo: 751600, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
  },
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 176100,
  medicareRate: 0.0145,
};

export interface Ytd {
  gross: number;
  federal: number;
  socialSecurity: number;
  medicare: number;
  state: number;
  preTax: number;
  postTax: number;
  net: number;
}

export const ZERO_YTD: Ytd = {
  gross: 0,
  federal: 0,
  socialSecurity: 0,
  medicare: 0,
  state: 0,
  preTax: 0,
  postTax: 0,
  net: 0,
};

export interface PayInput {
  grossCents: number;
  preTaxCents: number; // e.g. 401k, health premiums (reduce federal/state wages)
  postTaxCents: number;
  frequency: PayFrequency;
  filingStatus: FilingStatus;
  stateRate: number; // flat estimate, e.g. 0.04; 0 for no-income-tax states
  ytdBefore: Ytd;
  config?: TaxYearConfig;
}

export interface PayResult {
  grossCents: number;
  federalCents: number;
  socialSecurityCents: number;
  medicareCents: number;
  stateCents: number;
  preTaxCents: number;
  postTaxCents: number;
  netCents: number;
}

const round = (n: number) => Math.round(n);

export function annualizedFederalWithholding(
  taxableWagesPerPeriodCents: number,
  frequency: PayFrequency,
  status: FilingStatus,
  cfg: TaxYearConfig
): number {
  const periods = PERIODS_PER_YEAR[frequency];
  const annual = (taxableWagesPerPeriodCents / 100) * periods;
  const taxable = Math.max(0, annual - cfg.standardDeduction[status]);
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of cfg.brackets[status]) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upTo) - lower) * rate;
    lower = upTo;
  }
  return round((tax / periods) * 100);
}

export function calculatePay(input: PayInput): PayResult {
  const cfg = input.config ?? TAX_2025;
  const { grossCents, preTaxCents, postTaxCents } = input;
  if (grossCents < 0 || preTaxCents < 0 || postTaxCents < 0) {
    throw new Error("Amounts must not be negative");
  }
  if (preTaxCents > grossCents) throw new Error("Pre-tax deductions exceed gross pay");

  const incomeTaxWages = grossCents - preTaxCents;
  const federalCents = annualizedFederalWithholding(
    incomeTaxWages,
    input.frequency,
    input.filingStatus,
    cfg
  );

  // Social Security stops at the annual wage base, measured on YTD gross.
  const baseCents = cfg.socialSecurityWageBase * 100;
  const roomCents = Math.max(0, baseCents - input.ytdBefore.gross);
  const ssWages = Math.min(grossCents, roomCents);
  const socialSecurityCents = round(ssWages * cfg.socialSecurityRate);
  const medicareCents = round(grossCents * cfg.medicareRate);
  const stateCents = round(incomeTaxWages * input.stateRate);

  const netCents =
    grossCents -
    preTaxCents -
    federalCents -
    socialSecurityCents -
    medicareCents -
    stateCents -
    postTaxCents;

  return {
    grossCents,
    federalCents,
    socialSecurityCents,
    medicareCents,
    stateCents,
    preTaxCents,
    postTaxCents,
    netCents,
  };
}

export function addToYtd(ytd: Ytd, r: PayResult): Ytd {
  return {
    gross: ytd.gross + r.grossCents,
    federal: ytd.federal + r.federalCents,
    socialSecurity: ytd.socialSecurity + r.socialSecurityCents,
    medicare: ytd.medicare + r.medicareCents,
    state: ytd.state + r.stateCents,
    preTax: ytd.preTax + r.preTaxCents,
    postTax: ytd.postTax + r.postTaxCents,
    net: ytd.net + r.netCents,
  };
}

export const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
