import { isValidBarcode } from "@shopos/core";

/** Text that could be a barcode: code characters only, with at least one digit ("8901234567890"). */
export const looksLikeScannedCode = (query: string): boolean =>
  isValidBarcode(query) && /[0-9]/.test(query);
