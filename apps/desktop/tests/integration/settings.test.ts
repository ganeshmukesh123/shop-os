import { SettingsService } from "../../src/main/services/SettingsService";
import { createTestDb, type TestDb } from "../helpers/testDb";

let testDb: TestDb;
beforeEach(() => {
  testDb = createTestDb();
});

const valid = {
  name: "Prabhat Hardware",
  address: "Main Rd",
  phone: "9876543210",
  seriesCode: "C1",
  numberTemplate: "{series}/{fy}/{seq}",
  footer: "Thanks",
  receiptWidth: "80mm" as const,
  backupFolder: "",
  docTitle: "Estimate",
  roundBillTotal: true,
  timeZone: "Asia/Kolkata",
};

describe("settings", () => {
  it("returns defaults after first run and updates the profile", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);
    expect(settingsService.get().name).toBe("My Shop");
    expect(settingsService.update(valid).name).toBe("Prabhat Hardware");
    expect(settingsService.get().footer).toBe("Thanks");
  });

  it("rejects a number template that can exceed 16 characters", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);
    expect(() => settingsService.update({ ...valid, seriesCode: "COUNTER1" })).toThrow(/16/);
    expect(() => settingsService.update({ ...valid, numberTemplate: "{series}" })).toThrow(/seq/);
  });

  it("starts with the title 'Estimate', rounding on and the zone Asia/Kolkata (FR-010a, FR-015a, FR-019a)", () => {
    const profile = new SettingsService(testDb.db, testDb.ctx).get();

    expect(profile.docTitle).toBe("Estimate");
    expect(profile.roundBillTotal).toBe(true);
    expect(profile.timeZone).toBe("Asia/Kolkata");
  });

  it("saves and returns the title, the rounding switch, the zone and a4 as the paper", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);

    const saved = settingsService.update({
      ...valid,
      docTitle: "Cash Memo",
      roundBillTotal: false,
      timeZone: "America/Los_Angeles",
      receiptWidth: "a4",
    });

    expect(saved).toMatchObject({
      docTitle: "Cash Memo",
      roundBillTotal: false,
      timeZone: "America/Los_Angeles",
      receiptWidth: "a4",
    });
    expect(settingsService.get()).toEqual(saved);
  });

  it("rejects an unknown time zone and an empty title, and keeps the old settings", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);

    expect(() => settingsService.update({ ...valid, timeZone: "Mars/Olympus" })).toThrow();
    expect(() => settingsService.update({ ...valid, docTitle: "  " })).toThrow();

    expect(settingsService.get().timeZone).toBe("Asia/Kolkata");
    expect(settingsService.get().docTitle).toBe("Estimate");
  });

  it("requires a shop name", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);
    expect(() => settingsService.update({ ...valid, name: "  " })).toThrow();
  });
});
