import {
  billsCancelInput,
  billsExportPdfInput,
  billsGetInput,
  billsListInput,
  billsPrintInput,
  billsSaveInput,
  draftSaveInput,
  itemsCreateInput,
  itemsListInput,
  itemsUpdateInput,
  settingsSetThemeInput,
  stockAdjustInput,
  type CommandMap,
  type IFamilyCommandMap,
  type IMergeCommandMap,
  type CommandName,
  type Result,
} from "@shopos/core";
import type { BackupService } from "../services/BackupService";
import type { BillingService } from "../services/BillingService";
import type { CatalogueService } from "../services/catalogue";
import type { FamilyService } from "../services/families";
import type { InventoryService } from "../services/InventoryService";
import { searchRefreshedAfter, type SearchService } from "../services/search";
import type { PrintService } from "../services/PrintService";
import type { IRestoreNumberingPlan } from "../services/RestoreNumbering";
import type { SettingsService } from "../services/SettingsService";
import { cmd, none } from "./command";
import { createFamilyHandlers } from "./familyHandlers";
import { createMergeHandlers } from "./mergeHandlers";
import type { BarcodeService } from "../services/barcode";
import type { DataIssueService } from "../services/dataIssues";
import type { DuplicateService } from "../services/duplicates";
import type { MergeService } from "../services/merge";
import { createSystemHandlers, type SystemCommandName } from "./systemHandlers";

// Kept here so callers that import toFailure from handlers still work.
export { toFailure } from "./command";

export interface Services {
  inventory: InventoryService;
  /** The in-memory item search (spec 002 research D4), kept current by the item commands. */
  search: SearchService;
  /** Spec 002 US1: categories, brands and units; families and their variants */
  catalogue: CatalogueService;
  /** Spec 002 US2: barcode lookup, likely duplicates, merges */
  barcodes: BarcodeService;
  dataIssues: DataIssueService;
  duplicates: DuplicateService;
  merges: MergeService;
  families: FamilyService;
  billing: BillingService;
  settings: SettingsService;
  print: PrintService;
  backup: BackupService;
}

/** Things only the Electron shell can do (dialogs, restart). Injected so handlers stay testable. */
export interface Shell {
  pickFolder(): Promise<string | null>;
  pickBackupFile(): Promise<string | null>;
  pickPdfPath(defaultName: string): Promise<string | null>;
  /** Close the database, put the backup in place and relaunch. */
  scheduleRestore(filePath: string, numbering?: IRestoreNumberingPlan): void;
}

export type Handlers = {
  [K in CommandName]: (input: unknown) => Promise<Result<CommandMap[K][1]>>;
};

type ItemCommandName = "items.list" | "items.create" | "items.update" | "stock.adjust";
type ThemeCommandName = "settings.getTheme" | "settings.setTheme";
type BillCommandName = Exclude<
  CommandName,
  | ItemCommandName
  | SystemCommandName
  | ThemeCommandName
  | keyof IFamilyCommandMap
  | keyof IMergeCommandMap
>;

function createItemHandlers(services: Services): Pick<Handlers, ItemCommandName> {
  return {
    "items.list": cmd<"items.list">(itemsListInput, (commandInput) =>
      services.inventory.listItems(commandInput),
    ),
    "items.create": cmd<"items.create">(itemsCreateInput, (commandInput) =>
      searchRefreshedAfter(services.search, services.inventory.createItem(commandInput)),
    ),
    "items.update": cmd<"items.update">(itemsUpdateInput, (commandInput) =>
      searchRefreshedAfter(services.search, services.inventory.updateItem(commandInput)),
    ),
    "stock.adjust": cmd<"stock.adjust">(stockAdjustInput, (commandInput) =>
      services.inventory.adjustStock(commandInput),
    ),
  };
}

function createBillHandlers(services: Services): Pick<Handlers, BillCommandName> {
  return {
    "bills.draft.save": cmd<"bills.draft.save">(
      draftSaveInput,
      (commandInput: { payload: unknown }) => {
        services.billing.saveDraft(commandInput.payload);
        return {};
      },
    ),
    "bills.draft.load": cmd<"bills.draft.load">(none(), () => ({
      payload: services.billing.loadDraft(),
    })),
    "bills.save": cmd<"bills.save">(billsSaveInput, (commandInput) =>
      services.billing.saveBill(commandInput),
    ),
    "bills.list": cmd<"bills.list">(billsListInput, (commandInput) =>
      services.billing.listBills(commandInput),
    ),
    "bills.get": cmd<"bills.get">(billsGetInput, (commandInput: { id: string }) =>
      services.billing.getBill(commandInput.id),
    ),
    "bills.cancel": cmd<"bills.cancel">(billsCancelInput, (commandInput) =>
      services.billing.cancelBill(commandInput),
    ),
    "bills.gaps": cmd<"bills.gaps">(none(), () => ({ gaps: services.billing.listNumberGaps() })),
    "bills.print": cmd<"bills.print">(
      billsPrintInput,
      (commandInput: { id: string; target: "receipt" | "a4" | "a5" }) =>
        services.print.print(commandInput.id, commandInput.target),
    ),
    "bills.exportPdf": cmd<"bills.exportPdf">(
      billsExportPdfInput,
      (commandInput: { id: string; target: "receipt" | "a4" | "a5"; filePath: string }) =>
        services.print.exportPdf(commandInput.id, commandInput.target, commandInput.filePath),
    ),
  };
}

/** One handler per command in contracts/ipc-commands.md. */
export function createHandlers(services: Services, shell: Shell): Handlers {
  return {
    ...createItemHandlers(services),
    ...createBillHandlers(services),
    ...createSystemHandlers(services, shell),
    ...createFamilyHandlers(services),
    ...createMergeHandlers(services),
    // The screen's theme choice, kept in the database (spec 018 T035).
    "settings.getTheme": cmd<"settings.getTheme">(none(), () => services.settings.getTheme()),
    "settings.setTheme": cmd<"settings.setTheme">(settingsSetThemeInput, (commandInput) =>
      services.settings.setTheme(commandInput),
    ),
  };
}
