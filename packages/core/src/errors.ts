export type ErrorCode =
  | "DUPLICATE_NAME"
  | "DUPLICATE_SIGNATURE"
  | "SAME_ITEM"
  | "INVALID_BARCODE"
  | "ALREADY_MERGED"
  | "UNIT_MISMATCH"
  | "REVERSAL_WINDOW_CLOSED"
  | "ALREADY_REVERSED"
  | "SURVIVOR_MERGED"
  | "TOO_DEEP"
  | "MERGED"
  | "INVALID_FACTOR"
  | "BASE_UNIT_LISTED"
  | "UNKNOWN_UNIT"
  | "INVALID_QUANTITY"
  | "NOTE_REQUIRED"
  | "NOT_FOUND"
  | "EMPTY_BILL"
  | "INVALID_DISCOUNT"
  | "INVALID_AMOUNT"
  | "ITEM_INACTIVE"
  | "MISSING_PAINT_FIELDS"
  | "SEALED_PACK_DECIMAL"
  | "ALREADY_CANCELLED"
  | "REASON_REQUIRED"
  | "TOO_MANY_AXES"
  | "TOO_MANY_COMBINATIONS"
  | "UNKNOWN_ATTRIBUTE"
  | "PRINT_FAILED"
  | "WRITE_FAILED"
  | "INVALID_FIELD"
  | "BACKUP_FAILED"
  | "INEXACT_CONVERSION"
  | "INVALID_BACKUP"
  | "DATABASE_CORRUPT"
  | "INTERNAL";

export class CoreError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CoreError";
  }
}
