import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { SettingsRepository } from "../../src/main/repositories/SettingsRepository";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { PrintService, type HtmlRenderer } from "../../src/main/services/PrintService";
import { createTestDb, type TestDb } from "../helpers/testDb";

let testDb: TestDb;
let billId: string;
beforeEach(() => {
  testDb = createTestDb();
  const createdItem = new InventoryService(testDb.db, testDb.ctx).createItem({
    name: "A",
    unit: "pcs",
    pricePaise: 5000,
    openingQtyMilli: 5000,
  }).item;
  billId = new BillingService(testDb.db, testDb.ctx).saveBill({
    paymentMode: "cash",
    billDiscountPaise: 0,
    lines: [{ itemId: createdItem.id, quantityMilli: 1000, ratePaise: 5000, lineDiscountPaise: 0 }],
  }).bill.id;
});

const svc = (htmlRenderer: HtmlRenderer) =>
  new PrintService(
    new BillRepository(testDb.db, testDb.ctx),
    new SettingsRepository(testDb.db, testDb.ctx),
    htmlRenderer,
  );
const okRenderer: HtmlRenderer = {
  print: async () => ({ success: true }),
  toPdf: async () => Buffer.from("%PDF-fake"),
};
const counts = () =>
  testDb.sqlite
    .prepare(
      "select (select count(*) from bill) as billCount, (select count(*) from stock_movement) as movementCount",
    )
    .get();

describe("PrintService", () => {
  it("prints and exports a PDF", async () => {
    expect(await svc(okRenderer).print(billId, "receipt")).toEqual({ printed: true });
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "shopos-pdf-")), "b.pdf");
    expect((await svc(okRenderer).exportPdf(billId, "a4", file)).filePath).toBe(file);
    expect(fs.readFileSync(file, "utf8")).toBe("%PDF-fake");
  });

  it("a print failure returns PRINT_FAILED and leaves the bill untouched", async () => {
    const before = counts();
    const bad: HtmlRenderer = {
      ...okRenderer,
      print: async () => {
        throw new Error("no printer");
      },
    };
    await expect(svc(bad).print(billId, "receipt")).rejects.toMatchObject({ code: "PRINT_FAILED" });
    const reasoned: HtmlRenderer = {
      ...okRenderer,
      print: async () => ({ success: false, reason: "offline" }),
    };
    await expect(svc(reasoned).print(billId, "receipt")).rejects.toMatchObject({
      code: "PRINT_FAILED",
    });
    expect(counts()).toEqual(before);
    expect(new BillRepository(testDb.db, testDb.ctx).get(billId)!.bill.status).toBe("saved");
  });

  it("cancelling the print dialog is not an error", async () => {
    const cancelled: HtmlRenderer = {
      ...okRenderer,
      print: async () => ({ success: false, reason: "cancelled" }),
    };
    expect(await svc(cancelled).print(billId, "receipt")).toEqual({ printed: false });
  });

  it("a PDF write failure returns WRITE_FAILED", async () => {
    await expect(
      svc(okRenderer).exportPdf(billId, "a4", "/nonexistent-dir/x.pdf"),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" });
  });

  it("unknown bill is NOT_FOUND", async () => {
    await expect(svc(okRenderer).print("nope", "receipt")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
