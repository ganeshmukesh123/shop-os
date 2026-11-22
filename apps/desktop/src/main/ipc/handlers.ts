import { ZodError, type ZodTypeAny } from "zod";
import {
  CoreError,
  backupPlanRestoreInput,
  backupRestoreInput,
  type BackupPlanRestoreInput,
  type BackupRestoreInput,
  type IBackupRestoreResult,
  type IRestorePreview,
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
  settingsClockCheckInput,
  settingsUpdateInput,
  stockAdjustInput,
  type CommandMap,
  type CommandName,
  type Result,
} from "@shopos/core";
import type { BackupService } from "../services/BackupService";
import type { BillingService } from "../services/BillingService";
import type { InventoryService } from "../services/InventoryService";
import type { PrintService } from "../services/PrintService";
import type { IRestoreNumberingPlan } from "../services/RestoreNumbering";
import type { SettingsService } from "../services/SettingsService";
import { assertPlanIsConfirmed, planRestoreFor, toRestorePreview } from "./restoreCommands";

export interface Services {
  inventory: InventoryService;
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

const none = (): ZodTypeAny => ({ parse: (rawInput: unknown) => rawInput }) as ZodTypeAny;

export function toFailure(caughtError: unknown): Extract<Result<never>, { ok: false }> {
  if (caughtError instanceof CoreError)
    return {
      ok: false,
      code: caughtError.code,
      message: caughtError.message,
      details: caughtError.details,
    };
  if (caughtError instanceof ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      message: caughtError.issues.map((validationIssue) => validationIssue.message).join("; "),
    };
  }
  console.error("Unexpected error in command", caughtError);
  return {
    ok: false,
    code: "INTERNAL",
    message: "Something went wrong. Nothing was lost; please try again.",
  };
}

function cmd<K extends CommandName>(
  schema: ZodTypeAny,
  run: (input: never) => Promise<CommandMap[K][1]> | CommandMap[K][1],
) {
  return async (raw: unknown): Promise<Result<CommandMap[K][1]>> => {
    try {
      const input = schema.parse(raw);
      return { ok: true, data: await run(input as never) };
    } catch (caughtError) {
      return toFailure(caughtError);
    }
  };
}

type ItemCommandName = "items.list" | "items.create" | "items.update" | "stock.adjust";
type SystemCommandName = Extract<
  CommandName,
  `settings.${string}` | `backup.${string}` | `system.${string}`
>;
type BillCommandName = Exclude<CommandName, ItemCommandName | SystemCommandName>;

function createItemHandlers(services: Services): Pick<Handlers, ItemCommandName> {
  return {
    "items.list": cmd<"items.list">(itemsListInput, (commandInput) =>
      services.inventory.listItems(commandInput),
    ),
    "items.create": cmd<"items.create">(itemsCreateInput, (commandInput) =>
      services.inventory.createItem(commandInput),
    ),
    "items.update": cmd<"items.update">(itemsUpdateInput, (commandInput) =>
      services.inventory.updateItem(commandInput),
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

function createSystemHandlers(services: Services, shell: Shell): Pick<Handlers, SystemCommandName> {
  return {
    "settings.get": cmd<"settings.get">(none(), () => services.settings.get()),
    "settings.update": cmd<"settings.update">(settingsUpdateInput, (commandInput) =>
      services.settings.update(commandInput),
    ),
    "settings.clockCheck": cmd<"settings.clockCheck">(
      settingsClockCheckInput,
      (commandInput: { deviceTimeZone: string }) =>
        services.settings.clockCheck(commandInput.deviceTimeZone),
    ),
    "backup.run": cmd<"backup.run">(none(), () => services.backup.run()),
    "backup.status": cmd<"backup.status">(none(), () => services.backup.status()),
    "backup.planRestore": cmd<"backup.planRestore">(
      backupPlanRestoreInput,
      async (commandInput: BackupPlanRestoreInput): Promise<IRestorePreview> =>
        toRestorePreview(await planRestoreFor(commandInput, new Date())),
    ),
    "backup.restore": cmd<"backup.restore">(
      backupRestoreInput,
      async (commandInput: BackupRestoreInput): Promise<IBackupRestoreResult> => {
        // Worked out again, never taken from the renderer; nothing is touched unless it still matches.
        const numbering = await planRestoreFor(commandInput, new Date());
        assertPlanIsConfirmed(numbering, commandInput.confirmedPreview);
        shell.scheduleRestore(commandInput.filePath, numbering);
        return { restored: true, ...toRestorePreview(numbering) };
      },
    ),
    "system.pickFolder": cmd<"system.pickFolder">(none(), async () => ({
      path: await shell.pickFolder(),
    })),
    "system.pickBackupFile": cmd<"system.pickBackupFile">(none(), async () => ({
      path: await shell.pickBackupFile(),
    })),
    "system.pickPdfPath": cmd<"system.pickPdfPath">(
      { parse: (rawInput: unknown) => rawInput } as ZodTypeAny,
      async (commandInput: { defaultName: string }) => ({
        path: await shell.pickPdfPath(commandInput.defaultName),
      }),
    ),
  };
}

/** One handler per command in contracts/ipc-commands.md. */
export function createHandlers(services: Services, shell: Shell): Handlers {
  return {
    ...createItemHandlers(services),
    ...createBillHandlers(services),
    ...createSystemHandlers(services, shell),
  };
}
