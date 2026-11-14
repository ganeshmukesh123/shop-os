import { describe, expect, it } from "vitest";
import type { Bill, ShopProfile } from "@shopos/core";
import { renderBillHtml } from "../../src/main/services/billHtml";

const PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
};

const buildBill = (overrides: Partial<Bill> = {}): Bill => ({
  id: "b1",
  number: "C1/26-27/000001",
  seriesCode: "C1",
  seq: 1,
  billDate: "2026-12-07T14:05:09",
  customerName: null,
  paymentMode: "cash",
  linesTotalPaise: 0,
  billDiscountPaise: 0,
  grandTotalPaise: 0,
  status: "saved",
  cancelReason: null,
  cancelledAt: null,
  ...overrides,
});

describe("bill HTML edge cases", () => {
  it("shows a date that is not in the expected format exactly as stored", () => {
    const html = renderBillHtml(buildBill({ billDate: "yesterday" }), [], PROFILE, "receipt");
    expect(html).toContain("Date: yesterday");
  });

  it("shows an unknown payment mode as escaped text instead of failing", () => {
    const unknownMode = "<b>cheque</b>" as unknown as Bill["paymentMode"];
    const html = renderBillHtml(buildBill({ paymentMode: unknownMode }), [], PROFILE, "receipt");
    expect(html).toContain("Payment: &lt;b&gt;cheque&lt;/b&gt;");
  });

  it("shows the CANCELLED banner with an empty reason when none was stored", () => {
    const html = renderBillHtml(buildBill({ status: "cancelled" }), [], PROFILE, "receipt");
    expect(html).toContain("CANCELLED");
  });

  it("shows the cancel reason in the CANCELLED banner when there is one", () => {
    const cancelled = buildBill({ status: "cancelled", cancelReason: "wrong customer" });
    expect(renderBillHtml(cancelled, [], PROFILE, "receipt")).toContain("wrong customer");
  });
});
