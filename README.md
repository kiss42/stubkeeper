# StubKeeper

Pay stubs for small employers (1–10 staff), generated from your own pay-run records. Runs entirely in the browser; data is stored in `localStorage` and never leaves the device.

- Payroll engine in `lib/payroll.ts` (integer cents, FICA with wage-base cap, annualized federal withholding, flat state estimate), covered by `lib/payroll.test.ts`.
- Year-to-date totals are derived from saved stubs, not typed in.
- Stubs are created in order per employee: no overlapping periods, no pay dates more than 7 days ahead.
- Each PDF carries a content-hash document ID.

**Tax tables are simplified estimates (2025 brackets, standard deduction only).** Verify against IRS Publication 15-T and your state's guidance before filing anything.

```bash
npm install --legacy-peer-deps
npm run dev
npx vitest run
```
