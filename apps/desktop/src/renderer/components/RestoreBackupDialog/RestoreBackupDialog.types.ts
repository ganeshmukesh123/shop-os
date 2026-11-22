import type { ShopProfile } from "@shopos/core";

export interface IRestoreBackupDialogProps {
  isOpen: boolean;
  /** The backup file the owner chose, shown by name so they can see it is the right one. */
  backupFileName: string;
  /** A bill number in the shop's own format, to show what to type. */
  example: string;
  /** What the owner has typed as the last printed bill number. */
  typedNumber: string;
  /** What the restore will do to the bill numbers, once checked; null until then. */
  planText: string | null;
  /** Why the check or the restore was refused, or null. The dialog stays open so the owner can correct it. */
  errorMessage: string | null;
  isBusy: boolean;
  onTypedNumberChange: (typedNumber: string) => void;
  /** Work out the plan for the typed number; nothing is replaced. */
  onCheck: () => void | Promise<void>;
  /** Restore the plan the owner was shown. */
  onRestore: () => void | Promise<void>;
  onCancel: () => void;
}

/** The part of the shop profile the example bill number needs. */
export type RestoreExampleProfile = Pick<ShopProfile, "seriesCode" | "numberTemplate" | "timeZone">;

export type ToastFunction = (kind: "success" | "error", text: string) => void;
