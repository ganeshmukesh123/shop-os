import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { CoreError } from "@shopos/core";
import { describe, expect, it } from "vitest";
import { BackupService, validateBackupFile } from "../../src/main/services/BackupService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { buildHandlersFixture, saveOneBill } from "../helpers/handlersFixture";
import { createTestDb } from "../helpers/testDb";

const makeTempFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), "shopos-services-"));

/** The code of the CoreError a callback throws, or "none". */
const errorCodeOf = (action: () => unknown): string => {
  try {
    action();
    return "none";
  } catch (caughtError) {
    return caughtError instanceof CoreError ? caughtError.code : "other";
  }
};

describe("BillingService.getBill", () => {
  it("returns the bill and its lines", async () => {
    const fixture = buildHandlersFixture();
    const billId = await saveOneBill(fixture);
    const { bill, lines } = fixture.services.billing.getBill(billId);
    expect(bill.id).toBe(billId);
    expect(lines).toHaveLength(1);
  });

  it("throws NOT_FOUND for an unknown bill id", () => {
    const { services } = buildHandlersFixture();
    expect(errorCodeOf(() => services.billing.getBill("missing"))).toBe("NOT_FOUND");
  });
});

describe("InventoryService edge cases", () => {
  const createService = () => {
    const testDb = createTestDb();
    return new InventoryService(testDb.db, testDb.ctx);
  };
  const newItem = (name: string) => ({ name, unit: "pcs", pricePaise: 10000, openingQtyMilli: 0 });

  it("lets an inactive item take a name that an active item uses, because it stays inactive", () => {
    const inventory = createService();
    inventory.createItem(newItem("Pipe"));
    const spare = inventory.createItem(newItem("Pipe spare")).item;
    inventory.updateItem({ id: spare.id, active: false });
    const renamed = inventory.updateItem({ id: spare.id, name: "Pipe" });
    expect(renamed.item.name).toBe("Pipe");
  });

  it("refuses to reactivate an item whose name is now used by an active item", () => {
    const inventory = createService();
    inventory.createItem(newItem("Pipe"));
    const spare = inventory.createItem(newItem("Pipe spare")).item;
    inventory.updateItem({ id: spare.id, active: false });
    inventory.updateItem({ id: spare.id, name: "Pipe" });
    expect(errorCodeOf(() => inventory.updateItem({ id: spare.id, active: true }))).toBe(
      "DUPLICATE_NAME",
    );
  });

  it("refuses to set stock below zero", () => {
    const inventory = createService();
    const pipe = inventory.createItem({ ...newItem("Pipe"), openingQtyMilli: 5000 }).item;
    const adjust = () =>
      inventory.adjustStock({ itemId: pipe.id, mode: "set", quantityMilli: -1000, note: "count" });
    expect(errorCodeOf(adjust)).toBe("INVALID_QUANTITY");
  });
});

describe("BackupService.prune without a usable folder", () => {
  it("does nothing when no backup folder is chosen", () => {
    const testDb = createTestDb();
    const unrelatedFolder = makeTempFolder();
    const unrelatedFile = path.join(unrelatedFolder, "20260101-000000.sqlite");
    fs.writeFileSync(unrelatedFile, "x");
    new BackupService(testDb.sqlite, testDb.db, testDb.ctx).prune(new Date(2027, 0, 1));
    expect(fs.existsSync(unrelatedFile)).toBe(true);
  });

  it("does nothing when the chosen folder does not exist", async () => {
    const fixture = buildHandlersFixture();
    const current = await fixture.handlers["settings.get"]({});
    if (!current.ok) throw new Error(current.message);
    const missingFolder = path.join(makeTempFolder(), "gone");
    await fixture.handlers["settings.update"]({ ...current.data, backupFolder: missingFolder });
    expect(() => fixture.services.backup.prune(new Date())).not.toThrow();
  });
});

describe("validateBackupFile", () => {
  it("rejects a database whose integrity check fails", () => {
    const file = path.join(makeTempFolder(), "damaged.sqlite");
    const damaged = new Database(file);
    damaged.exec("create table item (name text); create index item_name_idx on item (name)");
    damaged.exec("insert into item (name) values ('needle-AAAA'), ('hay-1'), ('hay-2')");
    damaged.close();
    // Change the stored row but not its index entry (the first copy in the file is the table row).
    const bytes = fs.readFileSync(file);
    bytes.write("needle-BBBB", bytes.indexOf("needle-AAAA"));
    fs.writeFileSync(file, bytes);
    expect(() => validateBackupFile(file)).toThrowError(/integrity check failed/);
  });

  it("rejects a file that does not exist", () => {
    expect(errorCodeOf(() => validateBackupFile("/definitely/not/here.sqlite"))).toBe(
      "INVALID_BACKUP",
    );
  });
});

describe("PrintService with a renderer that throws a plain string", () => {
  it("reports the string in the PRINT_FAILED message", async () => {
    const fixture = buildHandlersFixture({
      htmlRenderer: {
        print: () => Promise.reject("paper jam"),
        toPdf: async () => Buffer.from(""),
      },
    });
    const billId = await saveOneBill(fixture);
    await expect(fixture.services.print.print(billId, "receipt")).rejects.toMatchObject({
      code: "PRINT_FAILED",
      message: expect.stringContaining("paper jam"),
    });
  });

  it("reports the string in the WRITE_FAILED message", async () => {
    const fixture = buildHandlersFixture({
      htmlRenderer: {
        print: async () => ({ success: true }),
        toPdf: () => Promise.reject("disk full"),
      },
    });
    const billId = await saveOneBill(fixture);
    const filePath = path.join(makeTempFolder(), "bill.pdf");
    await expect(fixture.services.print.exportPdf(billId, "a4", filePath)).rejects.toMatchObject({
      code: "WRITE_FAILED",
      message: expect.stringContaining("disk full"),
    });
  });
});
