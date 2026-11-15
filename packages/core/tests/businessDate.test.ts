import { CoreError } from "../src/errors";
import { businessDateOf, financialYearOfBusinessDate } from "../src/businessDate";

const SHOP_ZONE = "Asia/Kolkata";

function errorCodeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof CoreError ? error.code : "NOT_A_CORE_ERROR";
  }
  return undefined;
}

describe("businessDateOf (FR-019a, research D22)", () => {
  it("23:50 IST on 31 March is still 31 March", () => {
    const instantMs = Date.UTC(2027, 2, 31, 18, 20);
    expect(businessDateOf(instantMs, SHOP_ZONE)).toBe("2027-03-31");
  });

  it("00:10 IST on 1 April is already 1 April", () => {
    const instantMs = Date.UTC(2027, 2, 31, 18, 40);
    expect(businessDateOf(instantMs, SHOP_ZONE)).toBe("2027-04-01");
  });

  it("depends on the zone given, never on the device's zone", () => {
    const instantMs = Date.UTC(2027, 2, 31, 18, 40);
    expect(businessDateOf(instantMs, "America/Los_Angeles")).toBe("2027-03-31");
    expect(businessDateOf(instantMs, "UTC")).toBe("2027-03-31");
    expect(businessDateOf(instantMs, SHOP_ZONE)).toBe("2027-04-01");
  });

  it("pads single-digit months and days", () => {
    expect(businessDateOf(Date.UTC(2026, 0, 5, 12), SHOP_ZONE)).toBe("2026-01-05");
  });

  it.each([-8_640_000_000_000_000, 8_640_000_000_000_000])(
    "accepts the Date range boundary %s",
    (instantMs) => {
      expect(() => businessDateOf(instantMs, "UTC")).not.toThrow();
    },
  );

  it.each([-8_640_000_000_000_001, 8_640_000_000_000_001])(
    "rejects an instant immediately outside the Date range: %s",
    (instantMs) => {
      expect(errorCodeOf(() => businessDateOf(instantMs, "UTC"))).toBe("INVALID_FIELD");
    },
  );

  it("refuses an unknown time zone", () => {
    expect(errorCodeOf(() => businessDateOf(0, "Mars/Olympus"))).toBe("INVALID_FIELD");
  });

  it("refuses a fractional or non-finite instant", () => {
    expect(errorCodeOf(() => businessDateOf(1.5, SHOP_ZONE))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => businessDateOf(Number.NaN, SHOP_ZONE))).toBe("INVALID_FIELD");
  });
});

describe("financialYearOfBusinessDate", () => {
  it("runs 1 April to 31 March", () => {
    expect(financialYearOfBusinessDate("2027-03-31")).toBe("26-27");
    expect(financialYearOfBusinessDate("2027-04-01")).toBe("27-28");
    expect(financialYearOfBusinessDate("2026-04-01")).toBe("26-27");
    expect(financialYearOfBusinessDate("2026-01-15")).toBe("25-26");
  });

  it("crosses the century as 99-00", () => {
    expect(financialYearOfBusinessDate("2099-06-01")).toBe("99-00");
  });

  it("puts 23:50 and 00:10 IST either side of 31 March in different years", () => {
    const beforeMidnight = businessDateOf(Date.UTC(2027, 2, 31, 18, 20), SHOP_ZONE);
    const afterMidnight = businessDateOf(Date.UTC(2027, 2, 31, 18, 40), SHOP_ZONE);
    expect(financialYearOfBusinessDate(beforeMidnight)).toBe("26-27");
    expect(financialYearOfBusinessDate(afterMidnight)).toBe("27-28");
  });

  it.each([
    "2027-02-29",
    "2028-02-30",
    "2027-04-31",
    "2027-01-00",
    "2027-01-32",
    "1900-02-29",
    "2100-02-29",
  ])("rejects the impossible calendar date %s", (businessDate) => {
    expect(errorCodeOf(() => financialYearOfBusinessDate(businessDate))).toBe("INVALID_FIELD");
  });

  it.each([
    ["2028-02-29", "27-28"],
    ["2000-02-29", "99-00"],
  ])("accepts leap day %s", (businessDate, financialYear) => {
    expect(financialYearOfBusinessDate(businessDate)).toBe(financialYear);
  });

  it("refuses text that is not a YYYY-MM-DD date", () => {
    expect(errorCodeOf(() => financialYearOfBusinessDate("31/03/2027"))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => financialYearOfBusinessDate("2027-13-01"))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => financialYearOfBusinessDate(""))).toBe("INVALID_FIELD");
  });
});
