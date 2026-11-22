import type {
  Bill,
  BackupStatus,
  BillLine,
  BillsCancelInput,
  BillsListInput,
  BillsSaveInput,
  Item,
  ItemsCreateInput,
  ItemsListInput,
  ItemsUpdateInput,
  PrintTarget,
  Result,
  ShopProfile,
  StockAdjustInput,
  StockMovement,
} from "./types";

/** Renderer to main-process commands (specs/001-shop-os-mvp/contracts/ipc-commands.md): name -> [input, data]. */
export interface CommandMap {
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
  "bills.print": [{ id: string; target: PrintTarget }, { printed: boolean }];
  "bills.exportPdf": [{ id: string; target: PrintTarget; filePath: string }, { filePath: string }];
  "settings.get": [Record<string, never>, ShopProfile];
  "settings.update": [ShopProfile, ShopProfile];
  "backup.run": [Record<string, never>, { path: string; finishedAt: string }];
  "backup.status": [Record<string, never>, BackupStatus];
  "backup.restore": [{ filePath: string }, { restored: boolean }];
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
  "bills.print",
  "bills.exportPdf",
  "settings.get",
  "settings.update",
  "backup.run",
  "backup.status",
  "backup.restore",
  "system.pickFolder",
  "system.pickBackupFile",
  "system.pickPdfPath",
] as const satisfies readonly CommandName[];

export type ShopOsApi = {
  [K in CommandName]: (input: CommandMap[K][0]) => Promise<Result<CommandMap[K][1]>>;
};
