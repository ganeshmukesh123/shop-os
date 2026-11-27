import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/**
 * Spec 018 T035 (migration 0015): the theme column. Adding its CHECK makes drizzle-kit rebuild
 * shop_profile, and the generated copy selected a "theme" column the old table does not have
 * (SQLite reads it as the text 'theme'). The copy now inserts null; this proves it on real rows.
 */
describe("upgrading a database for the theme column (spec 018 T035)", () => {
  it("keeps the shop profile and starts with no saved theme", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const profileRow = sqlite.prepare("select name, receipt_width, theme from shop_profile").get();

    expect(profileRow).toEqual({ name: "My Shop", receipt_width: "80mm", theme: null });
    expect(sqlite.prepare("select count(*) as bills from bill").get()).toEqual({ bills: 1 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("accepts the three choices after the upgrade and refuses anything else", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    sqlite.prepare("update shop_profile set theme = 'dark'").run();

    expect(sqlite.prepare("select theme from shop_profile").get()).toEqual({ theme: "dark" });
    expect(() => sqlite.prepare("update shop_profile set theme = 'theme'").run()).toThrow(
      /CHECK constraint failed/,
    );
  });
});
