import {
  formatQuantity,
  formatRupees,
  type Bill,
  type BillLine,
  type PrintTarget,
  type ShopProfile,
} from "@shopos/core";

const esc = (rawText: string): string =>
  rawText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const MODE_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  unpaid: "Unpaid",
};

/** A signed amount for the round-off line: 40 -> "+₹0.40", -49 -> "-₹0.49". */
const formatSignedRupees = (paise: number): string =>
  paise > 0 ? `+${formatRupees(paise)}` : `-${formatRupees(-paise)}`;

/** "2026-12-07T14:05:09" -> "07/12/2026 14:05" (no Date object, so output never depends on the machine's zone). */
function formatLocal(iso: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  return dateMatch
    ? `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]} ${dateMatch[4]}:${dateMatch[5]}`
    : iso;
}

/** Page width/size per target. 58mm narrows the receipt; A4/A5 use paper sizes. */
export function pageSpec(
  target: PrintTarget,
  profile: ShopProfile,
): { css: string; widthMm?: number; paper: "receipt" | "A4" | "A5" } {
  if (target === "a4")
    return { css: "@page { size: A4; margin: 12mm; } body { font-size: 13px; }", paper: "A4" };
  if (target === "a5")
    return { css: "@page { size: A5; margin: 10mm; } body { font-size: 12px; }", paper: "A5" };
  const receiptWidthMillimetres = profile.receiptWidth === "58mm" ? 58 : 80;
  return {
    css: `@page { size: ${receiptWidthMillimetres}mm auto; margin: 2mm; } body { width: ${receiptWidthMillimetres - 4}mm; font-size: 11px; }`,
    widthMm: receiptWidthMillimetres,
    paper: "receipt",
  };
}

/**
 * Render a bill per contracts/bill-layout.md. Uses only snapshot values and core formatting, so a
 * reprint is identical. No tax wording appears anywhere.
 */
export function renderBillHtml(
  bill: Bill,
  lines: BillLine[],
  profile: ShopProfile,
  target: PrintTarget,
): string {
  const spec = pageSpec(target, profile);
  const cancelled = bill.status === "cancelled";
  const rows = lines
    .map(
      (billLine) => `<tr>
  <td class="n">${billLine.lineNo}</td>
  <td class="name">${esc(billLine.itemNameSnapshot)}</td>
  <td class="r">${formatQuantity(billLine.quantityMilli)} ${esc(billLine.unitSnapshot)}</td>
  <td class="r">${formatRupees(billLine.ratePaise)}</td>
  <td class="r">${billLine.lineDiscountPaise > 0 ? `-${formatRupees(billLine.lineDiscountPaise)}` : ""}</td>
  <td class="r">${formatRupees(billLine.amountPaise)}</td>
</tr>`,
    )
    .join("\n");

  const customer = bill.customerName ? `<div>Customer: ${esc(bill.customerName)}</div>` : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(bill.number)}</title>
<style>
${spec.css}
* { box-sizing: border-box; }
body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #000; margin: 0 auto; }
.c { text-align: center; } .shop { font-size: 1.4em; font-weight: 700; }
.doc-title { font-weight: 700; letter-spacing: .08em; margin-bottom: 2px; }
.meta { margin: 6px 0; } .meta div { margin: 1px 0; }
table { width: 100%; border-collapse: collapse; margin-top: 6px; }
th, td { padding: 2px 3px; vertical-align: top; border-bottom: 1px dotted #888; }
th { text-align: left; border-bottom: 1px solid #000; } .r { text-align: right; white-space: nowrap; } .n { width: 1.6em; }
.name { word-break: break-word; }
.totals { margin-top: 6px; } .totals div { display: flex; justify-content: space-between; margin: 2px 0; }
.grand { font-size: 1.25em; font-weight: 700; border-top: 1px solid #000; padding-top: 3px; }
.cancelled { border: 2px solid #000; text-align: center; font-weight: 700; font-size: 1.3em; padding: 4px; margin: 6px 0; }
.footer { margin-top: 10px; text-align: center; }
tr { page-break-inside: avoid; } .totals, .footer { page-break-inside: avoid; }
</style></head>
<body>
<div class="c doc-title">${esc(bill.docTitle)}</div>
<div class="c"><div class="shop">${esc(profile.name)}</div>
${profile.address ? `<div>${esc(profile.address)}</div>` : ""}
${profile.phone ? `<div>${esc(profile.phone)}</div>` : ""}</div>
<div class="meta">
  <div>Bill No: <b>${esc(bill.number)}</b></div>
  <div>Date: ${formatLocal(bill.billDate)}</div>
  <div>Payment: ${MODE_LABEL[bill.paymentMode] ?? esc(bill.paymentMode)}</div>
  ${customer}
</div>
${cancelled ? `<div class="cancelled">CANCELLED<br><span style="font-weight:400;font-size:.7em">${esc(bill.cancelReason ?? "")}</span></div>` : ""}
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r"></th><th class="r">Amount</th></tr></thead>
<tbody>
${rows}
</tbody></table>
<div class="totals">
  <div><span>Total</span><span>${formatRupees(bill.linesTotalPaise)}</span></div>
  ${bill.billDiscountPaise > 0 ? `<div><span>Discount</span><span>-${formatRupees(bill.billDiscountPaise)}</span></div>` : ""}
  ${bill.roundOffPaise !== 0 ? `<div><span>Round off</span><span>${formatSignedRupees(bill.roundOffPaise)}</span></div>` : ""}
  <div class="grand"><span>Grand Total</span><span>${formatRupees(bill.grandTotalPaise)}</span></div>
</div>
<div class="footer">${profile.footer ? `<div>${esc(profile.footer)}</div>` : ""}<div>Thank you</div></div>
</body></html>`;
}
