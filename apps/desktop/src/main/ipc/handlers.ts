import { ZodError, type ZodTypeAny } from "zod";
import {
  CoreError,
  backupRestoreInput,
  type BackupRestoreInput,
  type IBackupRestoreResult,
  billsExportPdfInput,
  billsGetInput,
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
import { validateBackupFile } from "../services/BackupService";
import type { BillingService } from "../services/BillingService";
import type { InventoryService } from "../services/InventoryService";
import type { PrintService } from "../services/PrintService";
import { planRestoreNumbering, type IRestoreNumberingPlan } from "../services/RestoreNumbering";
import type { SettingsService } from "../services/SettingsService";

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

/** One handler per command in contracts/ipc-commands.md. Every handler validates input with the shared Zod schemas. */
export function createHandlers(services: Services, shell: Shell): Handlers {
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
    "bills.get": cmd<"bills.get">(billsGetInput, (commandInput: { id: string }) =>
      services.billing.getBill(commandInput.id),
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
    "backup.restore": cmd<"backup.restore">(
      backupRestoreInput,
      (commandInput: BackupRestoreInput): IBackupRestoreResult => {
        validateBackupFile(commandInput.filePath); // INVALID_BACKUP before anything is touched
        const numbering = planRestoreNumbering(
          commandInput.filePath,
          commandInput.lastIssuedBillNo ?? null,
          new Date(),
        ); // INVALID_FIELD for a bill number that does not fit, before anything is touched
        shell.scheduleRestore(commandInput.filePath, numbering);
        return {
          restored: true,
          nextBillNo: numbering.nextBillNo,
          ...(numbering.gap && {
            gapRecorded: {
              seqFrom: numbering.gap.seqFrom,
              seqTo: numbering.gap.seqTo,
              isEstimated: numbering.gap.isEstimated,
            },
          }),
        };
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
