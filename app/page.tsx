"use client";

import { useEffect, useState } from "react";
import { dollars, PayFrequency, FilingStatus } from "@/lib/payroll";
import { createRun, emptyState, Employee, load, save, State, today } from "@/lib/store";
import { download, renderStub } from "@/lib/pdf";

const input = "w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const btn = "rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900";

export default function Home() {
  const [s, setS] = useState<State>(emptyState());
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setS(load());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(s);
  }, [s, ready]);

  const [emp, setEmp] = useState({
    name: "", address: "", pay: "hourly" as "hourly" | "salary", amount: "",
    frequency: "biweekly" as PayFrequency, filingStatus: "single" as FilingStatus, stateRate: "0",
  });
  const [run, setRun] = useState({
    employeeId: "", payDate: today(), periodStart: "", periodEnd: "", hours: "", pre: "0", post: "0",
  });

  const addEmployee = () => {
    setErr("");
    const amt = Math.round(parseFloat(emp.amount) * 100);
    if (!emp.name.trim() || !(amt > 0)) return setErr("Employee needs a name and a pay amount.");
    const e: Employee = {
      id: crypto.randomUUID().slice(0, 8),
      name: emp.name.trim(),
      address: emp.address.trim(),
      hourlyRateCents: emp.pay === "hourly" ? amt : null,
      salaryCents: emp.pay === "salary" ? amt : null,
      frequency: emp.frequency,
      filingStatus: emp.filingStatus,
      stateRate: Math.max(0, parseFloat(emp.stateRate) || 0) / 100,
    };
    setS({ ...s, employees: [...s.employees, e] });
    setRun({ ...run, employeeId: e.id });
    setEmp({ ...emp, name: "", address: "", amount: "" });
  };

  const selected = s.employees.find((e) => e.id === run.employeeId);

  const addRun = async () => {
    setErr("");
    if (!s.business.name.trim()) return setErr("Enter your business name first.");
    if (!selected) return setErr("Add and select an employee.");
    try {
      const { state, run: r } = await createRun(s, {
        employeeId: selected.id,
        payDate: run.payDate,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        hours: selected.hourlyRateCents != null ? parseFloat(run.hours) || 0 : null,
        preTaxCents: Math.round((parseFloat(run.pre) || 0) * 100),
        postTaxCents: Math.round((parseFloat(run.post) || 0) * 100),
      });
      setS(state);
      download(await renderStub(state.business, selected, r), `stub-${r.docId}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create stub.");
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6 text-neutral-900 dark:text-neutral-100">
      <header>
        <h1 className="text-2xl font-semibold">StubKeeper</h1>
        <p className="text-sm text-neutral-500">
          Pay stubs for small employers, built from your own pay-run records. Everything stays in this browser.
          Tax amounts are estimates for recordkeeping — verify against IRS Pub 15-T and your state before filing.
        </p>
      </header>

      {err && <p role="alert" className="rounded border border-red-400 bg-red-50 p-2 text-sm text-red-800">{err}</p>}

      <section className="space-y-2">
        <h2 className="font-medium">1. Business</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={input} placeholder="Business name" value={s.business.name} onChange={(e) => setS({ ...s, business: { ...s.business, name: e.target.value } })} />
          <input className={input} placeholder="Address" value={s.business.address} onChange={(e) => setS({ ...s, business: { ...s.business, address: e.target.value } })} />
          <input className={input} placeholder="EIN (optional)" value={s.business.ein} onChange={(e) => setS({ ...s, business: { ...s.business, ein: e.target.value } })} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">2. Employees</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={input} placeholder="Full name" value={emp.name} onChange={(e) => setEmp({ ...emp, name: e.target.value })} />
          <input className={input} placeholder="Address" value={emp.address} onChange={(e) => setEmp({ ...emp, address: e.target.value })} />
          <select className={input} value={emp.pay} onChange={(e) => setEmp({ ...emp, pay: e.target.value as "hourly" | "salary" })}>
            <option value="hourly">Hourly</option><option value="salary">Salary (annual)</option>
          </select>
          <input className={input} placeholder={emp.pay === "hourly" ? "Hourly rate $" : "Annual salary $"} inputMode="decimal" value={emp.amount} onChange={(e) => setEmp({ ...emp, amount: e.target.value })} />
          <select className={input} value={emp.frequency} onChange={(e) => setEmp({ ...emp, frequency: e.target.value as PayFrequency })}>
            <option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="semimonthly">Semi-monthly</option><option value="monthly">Monthly</option>
          </select>
          <select className={input} value={emp.filingStatus} onChange={(e) => setEmp({ ...emp, filingStatus: e.target.value as FilingStatus })}>
            <option value="single">Single</option><option value="married">Married filing jointly</option>
          </select>
          <input className={input} placeholder="State tax rate % (est.)" inputMode="decimal" value={emp.stateRate} onChange={(e) => setEmp({ ...emp, stateRate: e.target.value })} />
        </div>
        <button className={btn} onClick={addEmployee}>Add employee</button>
        <ul className="text-sm text-neutral-600 dark:text-neutral-400">
          {s.employees.map((e) => <li key={e.id}>{e.name} — {e.hourlyRateCents != null ? `${dollars(e.hourlyRateCents)}/h` : `${dollars(e.salaryCents ?? 0)}/yr`}, {e.frequency}</li>)}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">3. Run payroll</h2>
        <p className="text-xs text-neutral-500">Stubs are created in order. Year-to-date totals come from your saved stubs and can&apos;t be typed in.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={input} value={run.employeeId} onChange={(e) => setRun({ ...run, employeeId: e.target.value })}>
            <option value="">Select employee</option>
            {s.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <label className="text-xs">Pay date<input type="date" className={input} value={run.payDate} onChange={(e) => setRun({ ...run, payDate: e.target.value })} /></label>
          <label className="text-xs">Period start<input type="date" className={input} value={run.periodStart} onChange={(e) => setRun({ ...run, periodStart: e.target.value })} /></label>
          <label className="text-xs">Period end<input type="date" className={input} value={run.periodEnd} onChange={(e) => setRun({ ...run, periodEnd: e.target.value })} /></label>
          {selected?.hourlyRateCents != null && (
            <label className="text-xs">Hours worked<input className={input} inputMode="decimal" value={run.hours} onChange={(e) => setRun({ ...run, hours: e.target.value })} /></label>
          )}
          <label className="text-xs">Pre-tax deductions $<input className={input} inputMode="decimal" value={run.pre} onChange={(e) => setRun({ ...run, pre: e.target.value })} /></label>
          <label className="text-xs">Post-tax deductions $<input className={input} inputMode="decimal" value={run.post} onChange={(e) => setRun({ ...run, post: e.target.value })} /></label>
        </div>
        <button className={btn} onClick={addRun}>Create stub &amp; download PDF</button>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Saved stubs</h2>
        <table className="w-full text-left text-sm">
          <thead><tr className="text-neutral-500"><th>#</th><th>Employee</th><th>Pay date</th><th>Net</th><th>Doc ID</th><th></th></tr></thead>
          <tbody>
            {s.runs.map((r) => {
              const e = s.employees.find((x) => x.id === r.employeeId)!;
              return (
                <tr key={r.id}>
                  <td>{r.seq}</td><td>{e?.name}</td><td>{r.payDate}</td><td>{dollars(r.result.netCents)}</td><td className="font-mono">{r.docId}</td>
                  <td><button className="underline" onClick={async () => download(await renderStub(s.business, e, r), `stub-${r.docId}.pdf`)}>PDF</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
