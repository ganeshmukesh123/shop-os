export type ErrorCode =
  | "DUPLICATE_NAME"
  | "INVALID_QUANTITY"
  | "NOTE_REQUIRED"
  | "NOT_FOUND"
  | "EMPTY_BILL"
  | "INVALID_DISCOUNT"
  | "INVALID_AMOUNT"
  | "ITEM_INACTIVE"
  | "ALREADY_CANCELLED"
  | "REASON_REQUIRED"
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
