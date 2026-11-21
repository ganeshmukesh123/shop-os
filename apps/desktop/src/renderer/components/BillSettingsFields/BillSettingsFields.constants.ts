import type { ReceiptWidth } from "@shopos/core";

/** The paper choices in the order the shop sees them: the usual receipt first. */
export const PAPER_CHOICES: readonly ReceiptWidth[] = ["80mm", "58mm", "a4", "a5"];

/** Longest document title the database accepts (check bill_doc_title_len). */
export const DOC_TITLE_MAX_LENGTH = 30;
