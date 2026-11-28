import type { Bill, BillLine, ShopProfile } from "@shopos/core";
import { renderBillHtml } from "../../src/main/services/billHtml";

/**
 * Spec 002 T067 (001 contracts/bill-layout.md "Tinted line"): a tinted can prints its colorants
 * under its own line and says it cannot be returned; an ordinary line prints as before.
 */
const PROFILE: ShopProfile = {
  name: "Test Hardware",
  address: "1 Market Road",
  phone: "9000000000",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};
const BILL: Bill = {
  id: "bill-1",
  number: "C1/26-27/000007",
  seriesCode: "C1",
  seq: 7,
  billDate: "2026-11-28T10:00:00",
  customerName: "Sharma",
  docTitle: "Estimate",
  paymentMode: "cash",
  linesTotalPaise: 151_000,
  billDiscountPaise: 0,
  roundOffPaise: 0,
  grandTotalPaise: 151_000,
  status: "posted",
  cancelReason: null,
  cancelledAt: null,
};
const ORDINARY: BillLine = {
  id: "line-1",
  billId: "bill-1",
  lineNo: 1,
  itemId: "royale-pastel-4l",
  itemNameSnapshot: "Royale Pastel 4 L",
  unitSnapshot: "pcs",
  quantityMilli: 1_000,
  ratePaise: 151_000,
  lineDiscountPaise: 0,
  amountPaise: 151_000,
};
const TINTED: BillLine = {
  ...ORDINARY,
  tint: {
    colorants: [
      { name: "Blue", qtyMilli: 12_500 },
      { name: "Black", qtyMilli: 750 },
    ],
  },
};

describe("printed bill: a tinted line (spec 002 T067)", () => {
  it("prints the colorants per can under the line and Non-returnable (tinted)", () => {
    const html = renderBillHtml(BILL, [TINTED], PROFILE, "receipt");

    expect(html).toContain("Blue 12.5 ml, Black 0.75 ml per can");
    expect(html).toContain("Non-returnable (tinted)");
    expect(html.indexOf("Royale Pastel 4 L")).toBeLessThan(html.indexOf("Blue 12.5 ml"));
  });

  it("prints an ordinary line with no tint row", () => {
    const html = renderBillHtml(BILL, [ORDINARY], PROFILE, "receipt");

    expect(html).not.toContain("Non-returnable");
  });
});
