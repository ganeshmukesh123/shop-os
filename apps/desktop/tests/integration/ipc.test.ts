import { COMMAND_NAMES } from "@shopos/core";
import { createHandlers, type Handlers } from "../../src/main/ipc/handlers";
import { BackupService } from "../../src/main/services/BackupService";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { BarcodeService } from "../../src/main/services/barcode";
import { DuplicateService } from "../../src/main/services/duplicates";
import { MergeService } from "../../src/main/services/merge";
import { SearchService } from "../../src/main/services/search";
import { CatalogueService } from "../../src/main/services/catalogue";
import { FamilyService } from "../../src/main/services/families";
import { PrintService } from "../../src/main/services/PrintService";
import { SettingsService } from "../../src/main/services/SettingsService";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { SettingsRepository } from "../../src/main/repositories/SettingsRepository";
import { createTestDb } from "../helpers/testDb";

let handlers: Handlers;
beforeEach(() => {
  const testDb = createTestDb();
  handlers = createHandlers(
    {
      inventory: new InventoryService(testDb.db, testDb.ctx),
      search: new SearchService(testDb.db, testDb.ctx),
      catalogue: new CatalogueService(testDb.db, testDb.ctx),
      families: new FamilyService(testDb.db, testDb.ctx),
      barcodes: new BarcodeService(testDb.db, testDb.ctx),
      duplicates: new DuplicateService(testDb.db, testDb.ctx),
      merges: new MergeService(testDb.db, testDb.ctx),
      billing: new BillingService(testDb.db, testDb.ctx),
      settings: new SettingsService(testDb.db, testDb.ctx),
      print: new PrintService(
        new BillRepository(testDb.db, testDb.ctx),
        new SettingsRepository(testDb.db, testDb.ctx),
        { print: async () => ({ success: true }), toPdf: async () => Buffer.from("x") },
      ),
      backup: new BackupService(testDb.sqlite, testDb.db, testDb.ctx),
    },
    {
      pickFolder: async () => null,
      pickBackupFile: async () => null,
      pickPdfPath: async () => null,
      scheduleRestore: () => {},
    },
  );
});

describe("IPC handlers", () => {
  it("has a handler for every command in the contract", () => {
    expect(Object.keys(handlers).sort()).toEqual([...COMMAND_NAMES].sort());
  });

  it("returns { ok: true, data } on success", async () => {
    const createResult = await handlers["items.create"]({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 1000,
    });
    expect(createResult.ok).toBe(true);
    const list = await handlers["items.list"]({ limit: 10, offset: 0 });
    expect(list.ok && list.data.total).toBe(1);
  });

  it("returns { ok: false, code } for domain errors, with duplicate details", async () => {
    await handlers["items.create"]({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 0,
    });
    const createResult = await handlers["items.create"]({
      name: "pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 0,
    });
    expect(createResult).toMatchObject({ ok: false, code: "DUPLICATE_NAME" });
    expect(!createResult.ok && (createResult.details as unknown[]).length).toBe(1);
  });

  it("rejects malformed input with INVALID_FIELD (renderer data is never trusted)", async () => {
    expect(
      await handlers["items.create"]({ name: "", unit: "pcs", pricePaise: -1, openingQtyMilli: 0 }),
    ).toMatchObject({ ok: false, code: "INVALID_FIELD" });
    expect(await handlers["items.list"]("garbage")).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
    expect(
      await handlers["bills.save"]({
        clientBillId: crypto.randomUUID(),
        paymentMode: "bitcoin",
        billDiscountPaise: 0,
        lines: [],
      }),
    ).toMatchObject({ ok: false, code: "INVALID_FIELD" });
  });

  it("maps EMPTY_BILL and INVALID_BACKUP", async () => {
    expect(
      await handlers["bills.save"]({
        clientBillId: crypto.randomUUID(),
        paymentMode: "cash",
        billDiscountPaise: 0,
        lines: [],
      }),
    ).toMatchObject({ ok: false, code: "EMPTY_BILL" });
    expect(
      await handlers["backup.restore"]({
        filePath: "/definitely/not/here.sqlite",
        confirmedPreview: { nextBillNo: "C1/26-27/000002" },
      }),
    ).toMatchObject({
      ok: false,
      code: "INVALID_BACKUP",
    });
  });

  it("settings round trip through the contract", async () => {
    const cur = await handlers["settings.get"]({});
    expect(cur.ok).toBe(true);
    if (cur.ok) {
      const updateResult = await handlers["settings.update"]({ ...cur.data, name: "Prabhat" });
      expect(updateResult.ok && updateResult.data.name).toBe("Prabhat");
      expect(await handlers["settings.update"]({ ...cur.data, name: "" })).toMatchObject({
        ok: false,
        code: "INVALID_FIELD",
      });
    }
  });
});
