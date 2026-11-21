import type { ShopProfile } from "@shopos/core";

export interface IRestoreBackupDialogProps {
  isOpen: boolean;
  /** The backup file the owner chose, shown by name so they can see it is the right one. */
  backupFileName: string;
  /** A bill number in the shop's own format, to show what to type. */
  example: string;
  /** Why the restore was refused, or null. The dialog stays open so the owner can correct it. */
  errorMessage: string | null;
  isBusy: boolean;
  /** Called with what the owner typed, trimmed; an empty string means "cannot say". */
  onRestore: (lastIssuedBillNo: string) => void | Promise<void>;
  onCancel: () => void;
}

/** The part of the shop profile the example bill number needs. */
export type RestoreExampleProfile = Pick<ShopProfile, "seriesCode" | "numberTemplate" | "timeZone">;

export type ToastFunction = (kind: "success" | "error", text: string) => void;
