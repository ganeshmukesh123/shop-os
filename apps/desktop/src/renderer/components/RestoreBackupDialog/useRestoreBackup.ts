import { useCallback, useState } from "react";
import type { ShopProfile } from "@shopos/core";
import { call, messageOf } from "../../state/api";
import type { IRestoreBackupDialogProps, ToastFunction } from "./RestoreBackupDialog.types";
import { restoreExampleNumber, restoreStartedMessage } from "./restoreMessages";

export interface IUseRestoreBackup {
  /** Ask the owner for a backup file, then open the dialog. */
  start: () => Promise<void>;
  /** Everything the pure dialog needs. */
  dialog: IRestoreBackupDialogProps;
}

const fileNameOf = (filePath: string | null): string => filePath?.split(/[\\/]/).pop() ?? "";

/**
 * The restore flow of the Settings screen: pick a file, ask for the last printed bill number, restore.
 * A refused number keeps the dialog open with the reason, so nothing is lost and the owner can correct it.
 */
export function useRestoreBackup(
  profile: ShopProfile | null,
  toast: ToastFunction,
): IUseRestoreBackup {
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const start = useCallback(async () => {
    try {
      const { path } = await call("system.pickBackupFile", {});
      if (path) {
        setErrorMessage(null);
        setPendingFile(path);
      }
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    }
  }, [toast]);

  const restore = async (lastIssuedBillNo: string) => {
    if (!pendingFile) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const result = await call("backup.restore", {
        filePath: pendingFile,
        ...(lastIssuedBillNo !== "" && { lastIssuedBillNo }),
      });
      toast("success", restoreStartedMessage(result));
      setPendingFile(null);
    } catch (caughtError) {
      setErrorMessage(messageOf(caughtError));
    } finally {
      setIsBusy(false);
    }
  };

  const cancel = () => {
    setPendingFile(null);
    setErrorMessage(null);
  };

  return {
    start,
    dialog: {
      isOpen: pendingFile !== null,
      backupFileName: fileNameOf(pendingFile),
      example: profile ? restoreExampleNumber(profile, new Date()) : "",
      errorMessage,
      isBusy,
      onRestore: restore,
      onCancel: cancel,
    },
  };
}
