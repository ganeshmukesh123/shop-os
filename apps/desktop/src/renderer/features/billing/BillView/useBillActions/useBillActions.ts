import { useState } from "react";
import type { Bill, PrintTarget } from "@shopos/core";
import { ApiError, call, messageOf } from "../../../../shared/api/api";
import { useToast } from "../../../../shared/components/Toast";
import { uiText } from "../../../../shared/text/strings";
import type { BillAction, IBillActions } from "./types";

/** Why a print failed; the bill is saved either way, and says so unless the printer itself failed. */
const printFailureText = (caughtError: unknown): string =>
  caughtError instanceof ApiError && caughtError.code === "PRINT_FAILED"
    ? messageOf(caughtError)
    : `${messageOf(caughtError)} ${uiText.bill.printFailedHint}`;

/** Print and Save PDF for a saved bill. A failure is shown beside the buttons; the bill stays saved. */
export function useBillActions(bill: Bill, target: PrintTarget): IBillActions {
  const toast = useToast();
  const [busy, setBusy] = useState<BillAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function print() {
    setBusy("print");
    setActionError(null);
    try {
      await call("bills.print", { id: bill.id, target });
    } catch (caughtError) {
      setActionError(printFailureText(caughtError));
    } finally {
      setBusy(null);
    }
  }

  async function pdf() {
    setBusy("pdf");
    setActionError(null);
    try {
      const { path } = await call("system.pickPdfPath", {
        defaultName: `${bill.number.replace(/[/\\]/g, "-")}.pdf`,
      });
      if (!path) return;
      await call("bills.exportPdf", { id: bill.id, target, filePath: path });
      toast("success", `${uiText.bill.pdfSaved}: ${path}`);
    } catch (caughtError) {
      setActionError(messageOf(caughtError));
    } finally {
      setBusy(null);
    }
  }

  return { busy, actionError, print, pdf };
}
