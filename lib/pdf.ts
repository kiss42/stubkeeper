import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { dollars } from "./payroll";
import type { Business, Employee, PayRun } from "./store";

export async function renderStub(b: Business, e: Employee, r: PayRun): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);
  let y = 740;

  const text = (t: string, x: number, size = 10, f = font, color = ink) =>
    page.drawText(t, { x, y, size, font: f, color });
  const row = (label: string, cur: string, ytd: string) => {
    text(label, 50);
    text(cur, 360, 10, font);
    text(ytd, 470, 10, font);
    y -= 16;
  };

  text(b.name || "Employer", 50, 16, bold);
  y -= 16;
  text(b.address, 50, 9, font, muted);
  y -= 12;
  if (b.ein) text(`EIN ${b.ein}`, 50, 9, font, muted);
  y -= 30;
  text("EARNINGS STATEMENT", 50, 12, bold);
  y -= 20;
  text(`Employee: ${e.name}`, 50);
  text(`Pay date: ${r.payDate}`, 360);
  y -= 14;
  text(e.address, 50, 9, font, muted);
  text(`Period: ${r.periodStart} to ${r.periodEnd}`, 360);
  y -= 30;

  text("", 50);
  text("Description", 50, 9, bold);
  text("This period", 360, 9, bold);
  text("Year to date", 470, 9, bold);
  y -= 16;
  const x = r.result;
  const t = r.ytd;
  row(r.hours != null ? `Regular pay (${r.hours} h)` : "Salary", dollars(x.grossCents), dollars(t.gross));
  if (x.preTaxCents) row("Pre-tax deductions", `-${dollars(x.preTaxCents)}`, `-${dollars(t.preTax)}`);
  row("Federal income tax (est.)", `-${dollars(x.federalCents)}`, `-${dollars(t.federal)}`);
  row("Social Security", `-${dollars(x.socialSecurityCents)}`, `-${dollars(t.socialSecurity)}`);
  row("Medicare", `-${dollars(x.medicareCents)}`, `-${dollars(t.medicare)}`);
  if (x.stateCents) row("State income tax (est.)", `-${dollars(x.stateCents)}`, `-${dollars(t.state)}`);
  if (x.postTaxCents) row("Post-tax deductions", `-${dollars(x.postTaxCents)}`, `-${dollars(t.postTax)}`);
  y -= 8;
  page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: 562, y: y + 10 }, thickness: 0.5, color: muted });
  text("NET PAY", 50, 11, bold);
  text(dollars(x.netCents), 360, 11, bold);
  text(dollars(t.net), 470, 11, bold);

  page.drawText(
    `Document ID ${r.docId} · Stub #${r.seq} for this employee · Generated ${r.createdAt.slice(0, 10)} from stored pay-run records. ` +
      "Tax amounts are estimates for recordkeeping.",
    { x: 50, y: 40, size: 7.5, font, color: muted, maxWidth: 512 }
  );
  return doc.save();
}

export function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
