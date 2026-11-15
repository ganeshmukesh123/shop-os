import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { openDatabase } from "../../src/main/db/connection";
import { ensureSeed, loadCtx } from "../../src/main/db/seed";
import {
  backupLog,
  bill,
  billLine,
  draftBill,
  itemFamily,
  itemVariant,
  numberCounter,
  shopProfile,
  stockMovement,
} from "../../src/main/db/schema";
import { SettingsRepository } from "../../src/main/repositories/SettingsRepository";
import { MIGRATIONS, createTestDb } from "../helpers/testDb";

const openEmptyDatabase = () => openDatabase(":memory:", { migrationsFolder: MIGRATIONS });

describe("first-run seed", () => {
  it("creates the single business, shop and device once and returns the same context after", () => {
    const connection = openEmptyDatabase();
    const firstContext = ensureSeed(connection.db);
    const secondContext = ensureSeed(connection.db);
    expect(secondContext).toEqual(firstContext);
    expect(connection.db.select().from(shopProfile).all()).toHaveLength(1);
  });

  it("starts with the default shop profile", () => {
    const connection = openEmptyDatabase();
    ensureSeed(connection.db);
    const [profile] = connection.db.select().from(shopProfile).all();
    expect(profile).toMatchObject({ name: "My Shop", seriesCode: "C1", receiptWidth: "80mm" });
  });

  it("loadCtx returns the stored context of a seeded database", () => {
    const testDb = createTestDb();
    expect(loadCtx(testDb.db)).toEqual(testDb.ctx);
  });

  it("loadCtx seeds a database that has not been seeded yet", () => {
    const connection = openEmptyDatabase();
    const context = loadCtx(connection.db);
    expect(context.shopId).toBeTruthy();
    expect(connection.db.select().from(shopProfile).all()).toHaveLength(1);
  });

  it("refuses to read the profile of a shop that was never seeded", () => {
    const connection = openEmptyDatabase();
    const unseededContext = { businessId: "b", shopId: "s", deviceId: "d" };
    expect(() => new SettingsRepository(connection.db, unseededContext).get()).toThrowError(
      "shop profile missing",
    );
  });
});

describe("opening the database", () => {
  it("turns on foreign keys for an in-memory database", () => {
    const connection = openEmptyDatabase();
    expect(connection.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("uses write-ahead logging for a database file, so a crash cannot lose a saved bill", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-db-"));
    const connection = openDatabase(path.join(folder, "shopos.sqlite"), {
      migrationsFolder: MIGRATIONS,
    });
    expect(connection.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(connection.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    connection.sqlite.close();
  });
});

describe("schema contract", () => {
  const constraintNames = (table: Parameters<typeof getTableConfig>[0]) =>
    getTableConfig(table).checks.map((constraint) => constraint.name);
  const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
    getTableConfig(table).indexes.map((index) => index.config.name);

  it("guards the bill's payment mode, status, cancel reason, discount and total", () => {
    expect(constraintNames(bill)).toEqual(
      expect.arrayContaining([
        "bill_payment_mode",
        "bill_status",
        "bill_cancel_reason_required",
        "bill_discount_range",
        "bill_total_eq",
      ]),
    );
  });

  it("stops duplicate bill numbers, duplicate sequence numbers and duplicate saves", () => {
    expect(indexNames(bill)).toEqual(
      expect.arrayContaining(["bill_number_uq", "bill_series_fy_seq_uq", "bill_client_bill_id_uq"]),
    );
  });

  it("keeps stock and line amounts sane", () => {
    expect(constraintNames(stockMovement)).toEqual(
      expect.arrayContaining([
        "stock_movement_qty_pos",
        "stock_movement_one_direction",
        "stock_movement_adjustment_note",
      ]),
    );
    expect(constraintNames(billLine)).toEqual(
      expect.arrayContaining([
        "bill_line_qty_pos",
        "bill_line_rate_nonneg",
        "bill_line_discount_nonneg",
      ]),
    );
    expect(indexNames(stockMovement)).toContain("stock_movement_variant_idx");
  });

  it("limits item and shop profile fields", () => {
    expect(constraintNames(itemVariant)).toEqual(
      expect.arrayContaining([
        "item_variant_uom_len",
        "item_variant_price_nonneg",
        "item_variant_active_bool",
      ]),
    );
    expect(indexNames(itemVariant)).toContain("item_variant_code_uq");
    expect(constraintNames(shopProfile)).toEqual(
      expect.arrayContaining(["shop_profile_name_len", "shop_profile_width"]),
    );
  });

  it("allows one counter per series and financial year, and only ok or failed backups", () => {
    expect(indexNames(numberCounter)).toContain("number_counter_uq");
    expect(constraintNames(backupLog)).toContain("backup_log_status");
  });

  it("ties each bill line to its bill and item, and each stock movement to its item and bill", () => {
    const referencedTables = (table: Parameters<typeof getTableConfig>[0]) =>
      getTableConfig(table)
        .foreignKeys.map((foreignKey) => getTableConfig(foreignKey.reference().foreignTable).name)
        .sort();
    expect(referencedTables(billLine)).toEqual(["bill", "item_variant"]);
    expect(referencedTables(stockMovement)).toEqual(["item_variant", "location", "location"]);
    expect(referencedTables(itemVariant)).toEqual(["item_family"]);
  });

  it("names every table and column in snake_case", () => {
    const tables = [
      itemFamily,
      itemVariant,
      bill,
      billLine,
      stockMovement,
      shopProfile,
      numberCounter,
      draftBill,
      backupLog,
    ];
    const allNames = tables.flatMap((table) => {
      const config = getTableConfig(table);
      return [config.name, ...config.columns.map((column) => column.name)];
    });
    expect(allNames.every((name) => /^[a-z][a-z0-9_]*$/.test(name))).toBe(true);
  });
});
