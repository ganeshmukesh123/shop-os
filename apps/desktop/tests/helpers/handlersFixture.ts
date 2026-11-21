import {
  createHandlers,
  type Handlers,
  type Services,
  type Shell,
} from "../../src/main/ipc/handlers";
import { BackupService } from "../../src/main/services/BackupService";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { PrintService, type HtmlRenderer } from "../../src/main/services/PrintService";
import type { IRestoreNumberingPlan } from "../../src/main/services/RestoreNumbering";
import { SettingsService } from "../../src/main/services/SettingsService";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { SettingsRepository } from "../../src/main/repositories/SettingsRepository";
import { createTestDb, type TestDb } from "./testDb";

export interface IShellCalls {
  pickedPdfNames: string[];
  restoredFiles: string[];
  /** The bill-number plan the command gave the shell for each scheduled restore. */
  restoredPlans: (IRestoreNumberingPlan | undefined)[];
}

export interface IHandlersFixture {
  handlers: Handlers;
  services: Services;
  testDb: TestDb;
  shellCalls: IShellCalls;
}

export interface IFixtureOptions {
  htmlRenderer?: HtmlRenderer;
  pickedFolder?: string | null;
  pickedBackupFile?: string | null;
  pickedPdfPath?: string | null;
}

const FAKE_PDF_BYTES = Buffer.from("%PDF-fake");

/** Real services on an in-memory database, with the Electron-only shell replaced by a recording fake. */
export function buildHandlersFixture(options: IFixtureOptions = {}): IHandlersFixture {
  const testDb = createTestDb();
  const shellCalls: IShellCalls = { pickedPdfNames: [], restoredFiles: [], restoredPlans: [] };
  const htmlRenderer: HtmlRenderer = options.htmlRenderer ?? {
    print: async () => ({ success: true }),
    toPdf: async () => FAKE_PDF_BYTES,
  };
  const services: Services = {
    inventory: new InventoryService(testDb.db, testDb.ctx),
    billing: new BillingService(testDb.db, testDb.ctx),
    settings: new SettingsService(testDb.db, testDb.ctx),
    print: new PrintService(
      new BillRepository(testDb.db, testDb.ctx),
      new SettingsRepository(testDb.db, testDb.ctx),
      htmlRenderer,
    ),
    backup: new BackupService(testDb.sqlite, testDb.db, testDb.ctx),
  };
  const shell: Shell = {
    pickFolder: async () => options.pickedFolder ?? null,
    pickBackupFile: async () => options.pickedBackupFile ?? null,
    pickPdfPath: async (defaultName) => {
      shellCalls.pickedPdfNames.push(defaultName);
      return options.pickedPdfPath ?? null;
    },
    scheduleRestore: (filePath, numbering) => {
      shellCalls.restoredFiles.push(filePath);
      shellCalls.restoredPlans.push(numbering);
    },
  };
  return { handlers: createHandlers(services, shell), services, testDb, shellCalls };
}

const A_UNIT_PRICE_PAISE = 12000;

/** Creates an item and saves one bill for it through the handlers; returns the saved bill id. */
export async function saveOneBill(fixture: IHandlersFixture): Promise<string> {
  const created = await fixture.handlers["items.create"]({
    name: "PVC Pipe",
    unit: "pcs",
    pricePaise: A_UNIT_PRICE_PAISE,
    openingQtyMilli: 10000,
  });
  if (!created.ok) throw new Error(created.message);
  const saved = await fixture.handlers["bills.save"]({
    clientBillId: crypto.randomUUID(),
    paymentMode: "cash",
    billDiscountPaise: 0,
    lines: [
      {
        itemId: created.data.item.id,
        quantityMilli: 2000,
        ratePaise: A_UNIT_PRICE_PAISE,
        lineDiscountPaise: 0,
      },
    ],
  });
  if (!saved.ok) throw new Error(saved.message);
  return saved.data.bill.id;
}
