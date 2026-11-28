import { FAMILY_COMMAND_NAMES, type IFamilyCommandMap } from "./catalogue/familyCommandMap";
import { MERGE_COMMAND_NAMES, type IMergeCommandMap } from "./catalogue/mergeCommandMap";
import type { ClockWarning } from "./clockCheck";
import type { IRecordedNumberGap } from "./numberGap";
import type {
  Bill,
  BackupPlanRestoreInput,
  BackupRestoreInput,
  BackupStatus,
  BillLine,
  IBackupRestoreResult,
  IRestorePreview,
  BillsCancelInput,
  BillsListInput,
  BillsSaveInput,
  Item,
  ItemsCreateInput,
  ItemsListInput,
  ItemsUpdateInput,
  PrintTarget,
  Result,
  SettingsClockCheckInput,
  ShopProfile,
  StockAdjustInput,
  StockMovement,
} from "./types";
import type { SavedTheme, SettingsSetThemeInput } from "./theme";

/** Renderer to main-process commands (specs/001-shop-os-mvp/contracts/ipc-commands.md): name -> [input, data]. */
export interface CommandMap extends IFamilyCommandMap, IMergeCommandMap {
  "items.list": [ItemsListInput, { items: Item[]; total: number }];
  "items.create": [ItemsCreateInput, { item: Item }];
  "items.update": [ItemsUpdateInput, { item: Item }];
  "stock.adjust": [StockAdjustInput, { item: Item; movement: StockMovement | null }];
  "bills.draft.save": [{ payload: unknown }, Record<string, never>];
  "bills.draft.load": [Record<string, never>, { payload: unknown | null }];
  "bills.save": [BillsSaveInput, { bill: Bill; lines: BillLine[]; negativeStockItems: Item[] }];
  "bills.list": [BillsListInput, { bills: Bill[]; total: number }];
  "bills.get": [{ id: string }, { bill: Bill; lines: BillLine[] }];
  "bills.cancel": [BillsCancelInput, { bill: Bill }];
  /** Read only: the bill numbers a restore lost, newest record first (FR-013b). */
  "bills.gaps": [Record<string, never>, { gaps: IRecordedNumberGap[] }];
  "bills.print": [{ id: string; target: PrintTarget }, { printed: boolean }];
  "bills.exportPdf": [{ id: string; target: PrintTarget; filePath: string }, { filePath: string }];
  "settings.get": [Record<string, never>, ShopProfile];
  "settings.update": [ShopProfile, ShopProfile];
  /** Warnings only, never an error: the device zone differs from the shop's, or the clock went back. */
  "settings.clockCheck": [SettingsClockCheckInput, { warnings: ClockWarning[] }];
  /** The screen's theme, kept in the database so a new page origin cannot lose it (spec 018 T035). */
  "settings.getTheme": [Record<string, never>, SavedTheme];
  "settings.setTheme": [SettingsSetThemeInput, { theme: SettingsSetThemeInput["theme"] }];
  "backup.run": [Record<string, never>, { path: string; finishedAt: string }];
  "backup.status": [Record<string, never>, BackupStatus];
  /** Read only: what a restore of this file would do to the bill numbers (FR-013b). */
  "backup.planRestore": [BackupPlanRestoreInput, IRestorePreview];
  "backup.restore": [BackupRestoreInput, IBackupRestoreResult];
  /** Native file dialogs live in the main process; the renderer only receives the chosen path. */
  "system.pickFolder": [Record<string, never>, { path: string | null }];
  "system.pickBackupFile": [Record<string, never>, { path: string | null }];
  "system.pickPdfPath": [{ defaultName: string }, { path: string | null }];
}

export type CommandName = keyof CommandMap;

export const COMMAND_NAMES = [
  "items.list",
  "items.create",
  "items.update",
  "stock.adjust",
  "bills.draft.save",
  "bills.draft.load",
  "bills.save",
  "bills.list",
  "bills.get",
  "bills.cancel",
  "bills.gaps",
  "bills.print",
  "bills.exportPdf",
  "settings.get",
  "settings.update",
  "settings.clockCheck",
  "settings.getTheme",
  "settings.setTheme",
  "backup.run",
  "backup.status",
  "backup.planRestore",
  "backup.restore",
  "system.pickFolder",
  "system.pickBackupFile",
  "system.pickPdfPath",
  ...FAMILY_COMMAND_NAMES,
  ...MERGE_COMMAND_NAMES,
] as const satisfies readonly CommandName[];

export type ShopOsApi = {
  [K in CommandName]: (input: CommandMap[K][0]) => Promise<Result<CommandMap[K][1]>>;
};
