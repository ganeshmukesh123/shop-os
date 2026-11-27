export type ErrorCode =
  | "DUPLICATE_NAME"
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
