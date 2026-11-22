import { useCallback, useRef, useState } from "react";
import type { IRestorePreview, ShopProfile } from "@shopos/core";
import { call, messageOf } from "../../../../../shared/api/api";
import type { IRestoreBackupDialogProps, ToastFunction } from "./RestoreBackupDialog.types";
import { restoreExampleNumber, restorePlanMessage, restoreStartedMessage } from "./restoreMessages";

export interface IUseRestoreBackup {
  /** Ask the owner for a backup file, then open the dialog. */
  start: () => Promise<void>;
  /** Everything the pure dialog needs. */
  dialog: IRestoreBackupDialogProps;
}

/** The plan the owner was shown, with the number it was worked out for. */
interface ICheckedPlan {
  lastIssuedBillNo: string;
  preview: IRestorePreview;
}

const fileNameOf = (filePath: string | null): string => filePath?.split(/[\\/]/).pop() ?? "";

/** The command input for a file and a typed number; a blank number is left out ("cannot say"). */
const restoreSource = (filePath: string, lastIssuedBillNo: string) => ({
  filePath,
  ...(lastIssuedBillNo !== "" && { lastIssuedBillNo }),
});

/**
 * The restore flow of the Settings screen: pick a file, type the last printed bill number, check what
 * the restore will do, then restore exactly that plan. Changing the number forgets the plan, and a
 * refused restore asks for a new check, so the owner never confirms something they did not see.
 */
export function useRestoreBackup(
  profile: ShopProfile | null,
  toast: ToastFunction,
): IUseRestoreBackup {
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [typedNumber, setTypedNumber] = useState("");
  const [checkedPlan, setCheckedPlan] = useState<ICheckedPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  // Counts number changes, so a check that finishes after the number changed is ignored.
  const numberVersion = useRef(0);

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

  const changeTypedNumber = (nextNumber: string) => {
    numberVersion.current += 1;
    setTypedNumber(nextNumber);
    setCheckedPlan(null);
  };

  /** Runs one command for the dialog: busy while it runs, its refusal shown, the plan forgotten on failure. */
  const runStep = async (step: (filePath: string) => Promise<void>) => {
    if (!pendingFile) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await step(pendingFile);
    } catch (caughtError) {
      setCheckedPlan(null);
      setErrorMessage(messageOf(caughtError));
    } finally {
      setIsBusy(false);
    }
  };

  const check = () =>
    runStep(async (filePath) => {
      const lastIssuedBillNo = typedNumber.trim();
      const checkedVersion = numberVersion.current;
      const preview = await call("backup.planRestore", restoreSource(filePath, lastIssuedBillNo));
      const isStillTheTypedNumber = checkedVersion === numberVersion.current;
      if (isStillTheTypedNumber) {
        setCheckedPlan({ lastIssuedBillNo, preview });
      }
    });

  const restore = () =>
    runStep(async (filePath) => {
      if (!checkedPlan) return;
      const result = await call("backup.restore", {
        ...restoreSource(filePath, checkedPlan.lastIssuedBillNo),
        confirmedPreview: checkedPlan.preview,
      });
      toast("success", restoreStartedMessage(result));
      close();
    });

  const close = () => {
    setPendingFile(null);
    setTypedNumber("");
    setCheckedPlan(null);
    setErrorMessage(null);
  };

  return {
    start,
    dialog: {
      isOpen: pendingFile !== null,
      backupFileName: fileNameOf(pendingFile),
      example: profile ? restoreExampleNumber(profile, new Date()) : "",
      typedNumber,
      planText: checkedPlan ? restorePlanMessage(checkedPlan.preview) : null,
      errorMessage,
      isBusy,
      onTypedNumberChange: changeTypedNumber,
      onCheck: check,
      onRestore: restore,
      onCancel: close,
    },
  };
}
