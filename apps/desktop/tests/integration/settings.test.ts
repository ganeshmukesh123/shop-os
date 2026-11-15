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

  it("requires a shop name", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);
    expect(() => settingsService.update({ ...valid, name: "  " })).toThrow();
  });
});
