import { findClockWarnings, type IClockCheckInput } from "../src/clockCheck";

const NOW_MS = Date.UTC(2026, 10, 16, 9, 30); // 15:00 in India
const ONE_HOUR_MS = 3_600_000;

const buildInput = (overrides: Partial<IClockCheckInput> = {}): IClockCheckInput => ({
  deviceTimeZone: "Asia/Kolkata",
  shopTimeZone: "Asia/Kolkata",
  nowMs: NOW_MS,
  lastBilledAtMs: NOW_MS - ONE_HOUR_MS,
  ...overrides,
});

describe("findClockWarnings (task T080, FR-019a, EC-20 in part)", () => {
  it("has nothing to say when the device zone, the shop zone and the clock agree", () => {
    expect(findClockWarnings(buildInput())).toEqual([]);
  });

  it("warns when the device is set to another zone than the shop", () => {
    const warnings = findClockWarnings(buildInput({ deviceTimeZone: "America/Los_Angeles" }));

    expect(warnings).toEqual(["TIME_ZONE_DIFFERS"]);
  });

  it("does not warn for two names of the same zone (Asia/Calcutta is Asia/Kolkata)", () => {
    expect(findClockWarnings(buildInput({ deviceTimeZone: "Asia/Calcutta" }))).toEqual([]);
  });

  it("does not warn for two zones that have the same clock right now", () => {
    const summerInLondon = Date.UTC(2026, 6, 1, 9, 0);

    const warnings = findClockWarnings(
      buildInput({
        nowMs: summerInLondon,
        lastBilledAtMs: null,
        deviceTimeZone: "Europe/London",
        shopTimeZone: "Europe/Dublin",
      }),
    );

    expect(warnings).toEqual([]);
  });

  it("warns when UTC is the device zone and the shop is in India", () => {
    expect(findClockWarnings(buildInput({ deviceTimeZone: "UTC" }))).toEqual(["TIME_ZONE_DIFFERS"]);
  });

  it("warns when the clock is earlier than the last saved bill", () => {
    const warnings = findClockWarnings(buildInput({ lastBilledAtMs: NOW_MS + ONE_HOUR_MS }));

    expect(warnings).toEqual(["CLOCK_BEFORE_LAST_BILL"]);
  });

  it("does not warn when the clock equals the last bill's time, or no bill exists yet", () => {
    expect(findClockWarnings(buildInput({ lastBilledAtMs: NOW_MS }))).toEqual([]);
    expect(findClockWarnings(buildInput({ lastBilledAtMs: null }))).toEqual([]);
  });

  it("reports both problems, the zone first", () => {
    const warnings = findClockWarnings(
      buildInput({ deviceTimeZone: "UTC", lastBilledAtMs: NOW_MS + ONE_HOUR_MS }),
    );

    expect(warnings).toEqual(["TIME_ZONE_DIFFERS", "CLOCK_BEFORE_LAST_BILL"]);
  });

  it("cannot tell when the device zone is unknown, so it does not warn about the zone", () => {
    expect(findClockWarnings(buildInput({ deviceTimeZone: "" }))).toEqual([]);
    expect(findClockWarnings(buildInput({ deviceTimeZone: "Mars/Olympus" }))).toEqual([]);
  });

  it("still warns about the clock when the device zone is unknown", () => {
    const warnings = findClockWarnings(
      buildInput({ deviceTimeZone: "", lastBilledAtMs: NOW_MS + ONE_HOUR_MS }),
    );

    expect(warnings).toEqual(["CLOCK_BEFORE_LAST_BILL"]);
  });
});
