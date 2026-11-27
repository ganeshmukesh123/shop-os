import { CoreError } from "../src/errors";
import {
  DEFAULT_TIME_ZONE,
  businessDateOf,
  financialYearOfBusinessDate,
  isValidTimeZone,
  localIsoOf,
} from "../src/businessDate";

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

describe("the default shop time zone (research D22)", () => {
  it("is Asia/Kolkata until the shop sets its own", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Kolkata");
  });
});

describe("localIsoOf: the wall-clock time in the shop's zone", () => {
  it("shows 23:50 on 31 March in India for 18:20 UTC", () => {
    expect(localIsoOf(Date.UTC(2027, 2, 31, 18, 20), SHOP_ZONE)).toBe("2027-03-31T23:50:00");
  });

  it("shows 00:10 on 1 April in India for 18:40 UTC", () => {
    expect(localIsoOf(Date.UTC(2027, 2, 31, 18, 40), SHOP_ZONE)).toBe("2027-04-01T00:10:00");
  });

  it("shows midnight as 00, never 24", () => {
    expect(localIsoOf(Date.UTC(2027, 2, 31, 18, 30), SHOP_ZONE)).toBe("2027-04-01T00:00:00");
  });

  it("depends on the zone given, and drops fractions of a second", () => {
    const instantMs = Date.UTC(2027, 2, 31, 18, 40, 7, 999);

    expect(localIsoOf(instantMs, "UTC")).toBe("2027-03-31T18:40:07");
    expect(localIsoOf(instantMs, "America/Los_Angeles")).toBe("2027-03-31T11:40:07");
  });

  it("starts with the business date for the same instant", () => {
    const instantMs = Date.UTC(2026, 10, 15, 9, 30, 15);

    expect(localIsoOf(instantMs, SHOP_ZONE).slice(0, 10)).toBe(
      businessDateOf(instantMs, SHOP_ZONE),
    );
  });

  it("refuses an unknown zone or a fractional instant", () => {
    expect(errorCodeOf(() => localIsoOf(0, "Mars/Olympus"))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => localIsoOf(0.5, SHOP_ZONE))).toBe("INVALID_FIELD");
  });
});

describe("isValidTimeZone (FR-019a)", () => {
  it("accepts named zones the platform knows", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
  });

  it("refuses an unknown name, an empty text and a fixed offset", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("   ")).toBe(false);
    expect(isValidTimeZone("+05:30")).toBe(false);
  });

  it("refuses the words Luxon would read as the device's own zone", () => {
    expect(isValidTimeZone("local")).toBe(false);
    expect(isValidTimeZone("system")).toBe(false);
    expect(() => businessDateOf(0, "local")).toThrow(/unknown time zone/);
  });
});
