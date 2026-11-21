import type { Bill, BillLine, PrintTarget, ShopProfile } from "@shopos/core";
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

const postedBill: Bill = {
  id: "bill-1",
  number: "C1/26-27/000123",
  seriesCode: "C1",
  seq: 123,
  billDate: "2026-12-07T14:05:09",
  customerName: "Ravi Kumar",
  paymentMode: "cash",
  linesTotalPaise: 24000,
  billDiscountPaise: 0,
  grandTotalPaise: 24000,
  status: "posted",
  cancelReason: null,
  cancelledAt: null,
  docTitle: "Estimate",
  roundOffPaise: 0,
};

const billLines: BillLine[] = [
  {
    id: "line-1",
    billId: "bill-1",
    lineNo: 1,
    itemId: "item-1",
    itemNameSnapshot: "PVC Pipe",
    unitSnapshot: "pcs",
    quantityMilli: 2000,
    ratePaise: 12000,
    lineDiscountPaise: 0,
    amountPaise: 24000,
  },
];

const cancelledBillWith = (cancelReason: string | null): Bill => ({
  ...postedBill,
  status: "cancelled",
  cancelReason,
  cancelledAt: "2026-12-07T11:00:00.000Z",
});

const PRINT_TARGETS: PrintTarget[] = ["receipt", "a4", "a5"];
const BANNER_PATTERN = /<div class="cancelled">[\s\S]*?<\/div>/;

describe("a cancelled bill on paper (T065, FR-017)", () => {
  it.each(PRINT_TARGETS)("shows CANCELLED and the reason on the %s layout", (printTarget) => {
    const html = renderBillHtml(cancelledBillWith("Wrong item"), billLines, profile, printTarget);

    expect(html).toContain("CANCELLED");
    expect(html).toContain("Wrong item");
  });

  it("keeps the bill number, the lines and the totals as they were", () => {
    const html = renderBillHtml(cancelledBillWith("Wrong item"), billLines, profile, "receipt");

    expect(html).toContain("C1/26-27/000123");
    expect(html).toContain("PVC Pipe");
    expect(html).toContain("2 pcs");
    expect(html).toContain("₹240.00");
  });

  it("changes nothing but the banner: without it the page equals the posted bill's page", () => {
    const postedHtml = renderBillHtml(postedBill, billLines, profile, "a4");
    const cancelledHtml = renderBillHtml(cancelledBillWith("Wrong item"), billLines, profile, "a4");

    expect(cancelledHtml.replace(BANNER_PATTERN, "")).toBe(postedHtml);
  });

  it("puts the banner above the lines, where it cannot be missed", () => {
    const html = renderBillHtml(cancelledBillWith("Wrong item"), billLines, profile, "receipt");

    expect(html.indexOf("CANCELLED")).toBeLessThan(html.indexOf("<table"));
  });

  it("writes the reason as text, never as markup", () => {
    const html = renderBillHtml(
      cancelledBillWith(`<script>alert(1)</script> & "double"`),
      billLines,
      profile,
      "receipt",
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;double&quot;");
    expect(html).not.toContain("<script>");
  });

  it("still shows the banner, and no 'null' text, when the reason is missing", () => {
    const html = renderBillHtml(cancelledBillWith(null), billLines, profile, "receipt");

    expect(html).toContain("CANCELLED");
    expect(html).not.toMatch(/null|undefined/);
  });

  it("is identical when a cancelled bill is printed again", () => {
    const cancelledBill = cancelledBillWith("Wrong item");

    expect(renderBillHtml(cancelledBill, billLines, profile, "receipt")).toBe(
      renderBillHtml(cancelledBill, billLines, profile, "receipt"),
    );
  });
});

describe("a normal bill on paper stays as it was (T065)", () => {
  it.each(PRINT_TARGETS)("has no banner on the %s layout", (printTarget) => {
    const html = renderBillHtml(postedBill, billLines, profile, printTarget);

    expect(html).not.toContain("CANCELLED");
    expect(html).not.toMatch(BANNER_PATTERN);
  });

  it("ignores stale cancel details on a bill that is still posted", () => {
    const stalePostedBill: Bill = { ...postedBill, cancelReason: "left over" };

    expect(renderBillHtml(stalePostedBill, billLines, profile, "receipt")).toBe(
      renderBillHtml(postedBill, billLines, profile, "receipt"),
    );
  });
});
