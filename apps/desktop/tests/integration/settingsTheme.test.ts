import { SettingsService } from "../../src/main/services/SettingsService";
import { createHandlers } from "../../src/main/ipc/handlers";
import { createTestDb, type TestDb } from "../helpers/testDb";

// Spec 018 T035: the theme choice lives in the database, not in the page's localStorage, so the
// move to a private protocol (PR C, a new storage origin) cannot lose it.
let testDb: TestDb;
beforeEach(() => {
  testDb = createTestDb();
});

const profileSettings = {
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

function readThemeColumn(): unknown {
  return testDb.sqlite.prepare("select theme from shop_profile").get();
}

describe("settings theme (spec 018 T035)", () => {
  it("has no saved theme on a new database, so the screen can copy its old choice once", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);

    expect(settingsService.getTheme()).toEqual({ theme: null });
  });

  it("saves the choice and returns it on the next start", () => {
    new SettingsService(testDb.db, testDb.ctx).setTheme({ theme: "dark" });

    const nextStart = new SettingsService(testDb.db, testDb.ctx);

    expect(nextStart.getTheme()).toEqual({ theme: "dark" });
    expect(readThemeColumn()).toEqual({ theme: "dark" });
  });

  it("keeps the theme when the shop profile is saved from Settings", () => {
    const settingsService = new SettingsService(testDb.db, testDb.ctx);
    settingsService.setTheme({ theme: "light" });

    settingsService.update(profileSettings);

    expect(settingsService.getTheme()).toEqual({ theme: "light" });
  });

  it("refuses a theme the database does not allow", () => {
    expect(() => testDb.sqlite.prepare("update shop_profile set theme = 'purple'").run()).toThrow(
      /CHECK constraint failed/,
    );
  });
});

describe("settings.getTheme and settings.setTheme commands", () => {
  function buildHandlers() {
    const settings = new SettingsService(testDb.db, testDb.ctx);
    return createHandlers({ settings } as never, {} as never);
  }

  it("round-trips a choice through the command envelope", async () => {
    const handlers = buildHandlers();

    const saveResult = await handlers["settings.setTheme"]({ theme: "system" });
    const readResult = await handlers["settings.getTheme"]({});

    expect(saveResult).toEqual({ ok: true, data: { theme: "system" } });
    expect(readResult).toEqual({ ok: true, data: { theme: "system" } });
  });

  it("refuses an unknown theme with INVALID_FIELD and writes nothing", async () => {
    const handlers = buildHandlers();

    const saveResult = await handlers["settings.setTheme"]({ theme: "purple" } as never);

    expect(saveResult).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(readThemeColumn()).toEqual({ theme: null });
  });
});
