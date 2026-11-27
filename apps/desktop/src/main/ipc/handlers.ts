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
  type CommandName,
  type Result,
} from "@shopos/core";
import type { BackupService } from "../services/BackupService";
import type { BillingService } from "../services/BillingService";
import type { InventoryService } from "../services/InventoryService";
import { searchRefreshedAfter, type SearchService } from "../services/search";
import type { PrintService } from "../services/PrintService";
import type { IRestoreNumberingPlan } from "../services/RestoreNumbering";
import type { SettingsService } from "../services/SettingsService";
import { cmd, none } from "./command";
import { createSystemHandlers, type SystemCommandName } from "./systemHandlers";

// Kept here so callers that import toFailure from handlers still work.
export { toFailure } from "./command";

export interface Services {
  inventory: InventoryService;
  /** The in-memory item search (spec 002 research D4), kept current by the item commands. */
  search: SearchService;
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
type BillCommandName = Exclude<CommandName, ItemCommandName | SystemCommandName | ThemeCommandName>;

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
    // The screen's theme choice, kept in the database (spec 018 T035).
    "settings.getTheme": cmd<"settings.getTheme">(none(), () => services.settings.getTheme()),
    "settings.setTheme": cmd<"settings.setTheme">(settingsSetThemeInput, (commandInput) =>
      services.settings.setTheme(commandInput),
    ),
  };
}
