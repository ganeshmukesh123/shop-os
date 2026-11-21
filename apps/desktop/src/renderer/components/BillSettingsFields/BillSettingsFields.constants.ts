import type { ReceiptWidth } from "@shopos/core";

/** The paper choices in the order the shop sees them: the usual receipt first. */
export const PAPER_CHOICES: readonly ReceiptWidth[] = ["80mm", "58mm", "a4", "a5"];

/** Longest document title the database accepts (check bill_doc_title_len). */
export const DOC_TITLE_MAX_LENGTH = 30;

/** Element ids that tie the time-zone help and error to the field for screen readers. */
export const ZONE_HELP_ID = "bill-time-zone-help";
export const ZONE_ERROR_ID = "bill-time-zone-error";
