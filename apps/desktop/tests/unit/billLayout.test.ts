import { describe, expect, it } from "vitest";
import type { Bill, BillLine, ShopProfile } from "@shopos/core";
import { renderBillHtml } from "../../src/main/services/billHtml";

const profile: ShopProfile = {
  name: "Prabhat Hardware",
  address: "12 Main Road",
  phone: "9876543210",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "Goods once sold are not returnable",
  receiptWidth: "80mm",
  backupFolder: "",
};
const bill: Bill = {
  id: "b1",
  number: "C1/26-27/000123",
  seriesCode: "C1",
  seq: 123,
  billDate: "2026-12-07T14:05:09",
  customerName: "Ravi Kumar",
  paymentMode: "upi",
  linesTotalPaise: 10000000 + 12500,
  billDiscountPaise: 2500,
  grandTotalPaise: 10010000,
  status: "saved",
  cancelReason: null,
  cancelledAt: null,
};
const line = (lineNumber: number, over: Partial<BillLine> = {}): BillLine => ({
  id: `l${lineNumber}`,
  billId: "b1",
  lineNo: lineNumber,
  itemId: `i${lineNumber}`,
  itemNameSnapshot: `Item ${lineNumber}`,
  unitSnapshot: "pcs",
  quantityMilli: 2000,
  ratePaise: 5000,
  lineDiscountPaise: 0,
  amountPaise: 10000,
  ...over,
});
const lines = [
  line(1, {
    itemNameSnapshot: "PVC Pipe <20mm> & fittings",
    unitSnapshot: "metre",
    quantityMilli: 2500,
    ratePaise: 4000000,
    amountPaise: 10000000,
  }),
  line(2, { lineDiscountPaise: 500, amountPaise: 9500 }),
];

describe("bill layout", () => {
  it("contains header, lines, totals and footer", () => {
    const html = renderBillHtml(bill, lines, profile, "receipt");
    for (const expectedText of [
      "Prabhat Hardware",
      "12 Main Road",
      "9876543210",
      "C1/26-27/000123",
      "07/12/2026",
      "14:05",
      "UPI",
      "Ravi Kumar",
      "Goods once sold are not returnable",
      "Thank you",
    ]) {
      expect(html).toContain(expectedText);
    }
    expect(html).toContain("₹1,00,000.00"); // line 1 amount, Indian grouping
    expect(html).toContain("₹1,00,100.00"); // grand total
    expect(html).toContain("2.5 metre");
    expect(html).toContain("2 pcs");
  });

  it("escapes item names", () => {
    const html = renderBillHtml(bill, lines, profile, "receipt");
    expect(html).toContain("PVC Pipe &lt;20mm&gt; &amp; fittings");
    expect(html).not.toContain("<20mm>");
  });

  it("shows no tax wording anywhere", () => {
    for (const printTarget of ["receipt", "a4", "a5"] as const) {
      expect(renderBillHtml(bill, lines, profile, printTarget)).not.toMatch(
        /\b(tax|gst|cgst|sgst|igst)\b/i,
      );
    }
  });

  it("hides zero discounts and shows non-zero ones", () => {
    const none = renderBillHtml(
      { ...bill, billDiscountPaise: 0, grandTotalPaise: bill.linesTotalPaise },
      [line(1)],
      profile,
      "a4",
    );
    expect(none).not.toMatch(/Discount/i);
    const some = renderBillHtml(bill, lines, profile, "a4");
    expect(some).toMatch(/Discount/);
    expect(some).toContain("₹25.00");
    expect(some).toContain("₹5.00"); // line discount
  });

  it("omits customer block when none was entered", () => {
    const html = renderBillHtml({ ...bill, customerName: null }, lines, profile, "receipt");
    expect(html).not.toContain("Customer");
  });

  it("shows the CANCELLED banner with the reason", () => {
    const html = renderBillHtml(
      {
        ...bill,
        status: "cancelled",
        cancelReason: "Wrong item",
        cancelledAt: "2026-12-07T10:00:00Z",
      },
      lines,
      profile,
      "receipt",
    );
    expect(html).toContain("CANCELLED");
    expect(html).toContain("Wrong item");
    expect(renderBillHtml(bill, lines, profile, "receipt")).not.toContain("CANCELLED");
  });

  it("uses the page size for each target and the narrow width for 58mm", () => {
    expect(renderBillHtml(bill, lines, profile, "receipt")).toContain("80mm");
    expect(renderBillHtml(bill, lines, { ...profile, receiptWidth: "58mm" }, "receipt")).toContain(
      "58mm",
    );
    expect(renderBillHtml(bill, lines, profile, "a4")).toContain("A4");
    expect(renderBillHtml(bill, lines, profile, "a5")).toContain("A5");
  });

  it("is identical when rendered twice (reprint)", () => {
    expect(renderBillHtml(bill, lines, profile, "receipt")).toBe(
      renderBillHtml(bill, lines, profile, "receipt"),
    );
  });
});
