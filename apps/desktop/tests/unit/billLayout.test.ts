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
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};
const bill: Bill = {
  id: "b1",
  number: "C1/26-27/000123",
  seriesCode: "C1",
  seq: 123,
  billDate: "2026-12-07T14:05:09",
  customerName: "Ravi Kumar",
  docTitle: "Estimate",
  paymentMode: "upi",
  linesTotalPaise: 10000000 + 12500,
  billDiscountPaise: 2500,
  roundOffPaise: 0,
  grandTotalPaise: 10010000,
  status: "posted",
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

describe("bill layout: document title (task T081, FR-015a, research D23)", () => {
  const titleOf = (html: string): string | undefined =>
    /<div class="c doc-title">([^<]*)<\/div>/.exec(html)?.[1];

  it("prints the title 'Estimate' above the shop name by default", () => {
    const html = renderBillHtml(bill, lines, profile, "receipt");

    expect(titleOf(html)).toBe("Estimate");
    expect(html.indexOf("Estimate")).toBeLessThan(html.indexOf("Prabhat Hardware"));
  });

  it("prints the title stored on the bill, not the shop's current setting (a reprint is identical)", () => {
    const storedTitle = renderBillHtml(
      { ...bill, docTitle: "Estimate" },
      lines,
      { ...profile, docTitle: "Cash Memo" },
      "receipt",
    );
    const customTitle = renderBillHtml({ ...bill, docTitle: "Cash Memo" }, lines, profile, "a4");

    expect(titleOf(storedTitle)).toBe("Estimate");
    expect(titleOf(customTitle)).toBe("Cash Memo");
  });

  it("escapes the title", () => {
    const html = renderBillHtml({ ...bill, docTitle: "<b>Memo</b> & Co" }, lines, profile, "a5");

    expect(titleOf(html)).toBe("&lt;b&gt;Memo&lt;/b&gt; &amp; Co");
    expect(html).not.toContain("<b>Memo</b>");
  });

  it("prints the title on every paper size and on a cancelled bill", () => {
    for (const printTarget of ["receipt", "a4", "a5"] as const) {
      expect(titleOf(renderBillHtml(bill, lines, profile, printTarget))).toBe("Estimate");
    }
    const cancelled = renderBillHtml(
      { ...bill, status: "cancelled", cancelReason: "Wrong item" },
      lines,
      profile,
      "receipt",
    );
    expect(titleOf(cancelled)).toBe("Estimate");
    expect(cancelled).toContain("CANCELLED");
  });

  it("shows no tax wording with the default title", () => {
    expect(renderBillHtml(bill, lines, profile, "receipt")).not.toMatch(/\b(tax|gst)\b/i);
  });
});

describe("bill layout: round-off (task T081, FR-010a, research D20)", () => {
  // lines total 849.60, round-off +0.40, grand total 850.00
  const roundedUp = {
    ...bill,
    linesTotalPaise: 84960,
    billDiscountPaise: 0,
    roundOffPaise: 40,
    grandTotalPaise: 85000,
  };

  it("hides the round-off line when it is zero", () => {
    const html = renderBillHtml({ ...bill, roundOffPaise: 0 }, lines, profile, "a4");

    expect(html).not.toMatch(/Round off/i);
  });

  it("shows a positive round-off with a plus sign, between the discount and the grand total", () => {
    const html = renderBillHtml(roundedUp, lines, profile, "receipt");

    expect(html).toContain("Round off");
    expect(html).toContain("+₹0.40");
    expect(html.indexOf("Round off")).toBeLessThan(html.indexOf("Grand Total"));
    expect(html).toContain("₹850.00");
  });

  it("shows a negative round-off with a minus sign", () => {
    const html = renderBillHtml(
      {
        ...bill,
        linesTotalPaise: 84949,
        billDiscountPaise: 0,
        roundOffPaise: -49,
        grandTotalPaise: 84900,
      },
      lines,
      profile,
      "receipt",
    );

    expect(html).toContain("-₹0.49");
    expect(html).toContain("₹849.00");
  });

  it("puts the discount before the round-off when a bill has both", () => {
    const html = renderBillHtml(
      { ...roundedUp, linesTotalPaise: 100000, billDiscountPaise: 15040 },
      lines,
      profile,
      "receipt",
    );

    expect(html.indexOf("Discount")).toBeLessThan(html.indexOf("Round off"));
    expect(html.indexOf("Round off")).toBeLessThan(html.indexOf("Grand Total"));
  });

  it("prints the same round-off every time the bill is printed (reprint)", () => {
    expect(renderBillHtml(roundedUp, lines, profile, "receipt")).toBe(
      renderBillHtml(roundedUp, lines, profile, "receipt"),
    );
  });
});
