import type { ShopProfile } from "@shopos/core";
import { checkNumberTemplate } from "./numberTemplateCheck";

const PROFILE: ShopProfile = {
  name: "Prabhat Hardware",
  address: "",
  phone: "",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "",
  receiptWidth: "80mm",
  backupFolder: "",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

const NOVEMBER_2026 = new Date("2026-11-15T09:30:00.000Z");

describe("checkNumberTemplate", () => {
  it("gives an example number for the shop's financial year", () => {
    expect(checkNumberTemplate(PROFILE, NOVEMBER_2026)).toEqual({
      ok: true,
      example: "C1/26-27/000001",
    });
  });

  it("says why a template without {seq} is refused", () => {
    const check = checkNumberTemplate(
      { ...PROFILE, numberTemplate: "{series}/{fy}" },
      NOVEMBER_2026,
    );

    expect(check).toEqual({ ok: false, reason: "Template must contain {seq}" });
  });

  it("still gives an example while the time zone is half typed", () => {
    const check = checkNumberTemplate({ ...PROFILE, timeZone: "Asia/Kol" }, NOVEMBER_2026);

    expect(check.ok).toBe(true);
  });
});
