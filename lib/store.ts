import { addToYtd, calculatePay, FilingStatus, PayFrequency, PayResult, Ytd, ZERO_YTD } from "./payroll";

export interface Business {
  name: string;
  address: string;
  ein: string;
}

export interface Employee {
  id: string;
  name: string;
  address: string;
  hourlyRateCents: number | null; // null = salaried
  salaryCents: number | null; // annual
  frequency: PayFrequency;
  filingStatus: FilingStatus;
  stateRate: number;
}

export interface PayRun {
  id: string; // sequential per employee: 1, 2, 3 ...
  employeeId: string;
  seq: number;
  payDate: string; // YYYY-MM-DD
  periodStart: string;
  periodEnd: string;
  hours: number | null;
  preTaxCents: number;
  postTaxCents: number;
  result: PayResult;
  ytd: Ytd; // computed from stored runs at creation, never typed in
  docId: string;
  createdAt: string;
}

export interface State {
  business: Business;
  employees: Employee[];
  runs: PayRun[];
}

const KEY = "stubkeeper.v1";

export const emptyState = (): State => ({
  business: { name: "", address: "", ein: "" },
  employees: [],
  runs: [],
});

export function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export const today = () => new Date().toISOString().slice(0, 10);

export function grossFor(e: Employee, hours: number | null): number {
  if (e.hourlyRateCents != null) return Math.round((hours ?? 0) * e.hourlyRateCents);
  const periods = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[e.frequency];
  return Math.round((e.salaryCents ?? 0) / periods);
}

/** YTD is always derived from this employee's earlier runs in the same calendar year. */
export function ytdFor(s: State, employeeId: string, payDate: string): Ytd {
  const year = payDate.slice(0, 4);
  return s.runs
    .filter((r) => r.employeeId === employeeId && r.payDate.startsWith(year))
    .reduce((acc, r) => addToYtd(acc, r.result), ZERO_YTD);
}

export interface NewRun {
  employeeId: string;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  hours: number | null;
  preTaxCents: number;
  postTaxCents: number;
}

/** Throws a user-readable Error if the run breaks the recordkeeping rules. */
export function validateRun(s: State, n: NewRun): void {
  const t = today();
  const maxDate = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  if (n.payDate > maxDate) throw new Error("Pay date can be at most 7 days in the future.");
  if (n.periodStart > n.periodEnd) throw new Error("Pay period start is after its end.");
  if (n.periodEnd > n.payDate) throw new Error("Pay period must end on or before the pay date.");
  const mine = s.runs.filter((r) => r.employeeId === n.employeeId);
  const last = mine.reduce<PayRun | null>((a, r) => (!a || r.seq > a.seq ? r : a), null);
  if (last && n.periodStart <= last.periodEnd)
    throw new Error(`Pay period overlaps the previous stub (ends ${last.periodEnd}). Stubs are created in order.`);
  if (last && n.payDate < last.payDate) throw new Error("Pay date is earlier than the previous stub.");
  void t;
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createRun(s: State, n: NewRun): Promise<{ state: State; run: PayRun }> {
  validateRun(s, n);
  const emp = s.employees.find((e) => e.id === n.employeeId);
  if (!emp) throw new Error("Unknown employee.");
  const ytdBefore = ytdFor(s, emp.id, n.payDate);
  const result = calculatePay({
    grossCents: grossFor(emp, n.hours),
    preTaxCents: n.preTaxCents,
    postTaxCents: n.postTaxCents,
    frequency: emp.frequency,
    filingStatus: emp.filingStatus,
    stateRate: emp.stateRate,
    ytdBefore,
  });
  const seq = s.runs.filter((r) => r.employeeId === emp.id).length + 1;
  const body = JSON.stringify({ b: s.business, e: emp.id, seq, n, result });
  const docId = (await sha(body)).slice(0, 12).toUpperCase();
  const run: PayRun = {
    id: `${emp.id}-${seq}`,
    employeeId: emp.id,
    seq,
    payDate: n.payDate,
    periodStart: n.periodStart,
    periodEnd: n.periodEnd,
    hours: n.hours,
    preTaxCents: n.preTaxCents,
    postTaxCents: n.postTaxCents,
    result,
    ytd: addToYtd(ytdBefore, result),
    docId,
    createdAt: new Date().toISOString(),
  };
  return { state: { ...s, runs: [...s.runs, run] }, run };
}
