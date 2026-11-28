import { z } from "zod";
import { isValidTimeZone } from "./businessDate";
import type { ErrorCode } from "./errors";

/** Wire format: money = integer paise, quantity = integer thousandths. */
const paise = z.number().int().safe();
const nonNegPaise = paise.min(0);
const qtyMilli = z.number().int().safe();

export const PAYMENT_MODES = ["cash", "upi", "card", "unpaid"] as const;
export const paymentModeSchema = z.enum(PAYMENT_MODES);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const MOVEMENT_REASONS = [
  "opening",
  "adjustment",
  "sale",
  "sale_cancel",
  "merge_in",
  "merge_out",
] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

/** A bill moves from posted to cancelled once, and never back (data-model.md). */
export type BillStatus = "posted" | "cancelled";
/** The shop's default paper: a thermal roll (58 or 80 mm) or a sheet (A4, A5). */
export const RECEIPT_WIDTHS = ["58mm", "80mm", "a4", "a5"] as const;
export type ReceiptWidth = (typeof RECEIPT_WIDTHS)[number];
export type PrintTarget = "receipt" | "a4" | "a5";

// ---------- entities ----------
export interface Item {
  id: string;
  name: string;
  unit: string;
  allowsDecimal: boolean;
  pricePaise: number;
  stockMilli: number;
  active: boolean;
  needsCorrection: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string;
  quantityMilli: number;
  reason: MovementReason;
  note: string | null;
  billId: string | null;
  occurredAt: string;
}

export interface Bill {
  id: string;
  number: string;
  seriesCode: string;
  seq: number;
  billDate: string;
  customerName: string | null;
  /** The document title printed on this bill, stored when it was saved (FR-015a). */
  docTitle: string;
  paymentMode: PaymentMode;
  linesTotalPaise: number;
  billDiscountPaise: number;
  /** Signed difference to the nearest rupee: +40 for 849.60, -49 for 849.49, 0 when off (FR-010a). */
  roundOffPaise: number;
  grandTotalPaise: number;
  status: BillStatus;
  cancelReason: string | null;
  cancelledAt: string | null;
}

export interface BillLine {
  id: string;
  billId: string;
  lineNo: number;
  itemId: string;
  itemNameSnapshot: string;
  unitSnapshot: string;
  quantityMilli: number;
  ratePaise: number;
  lineDiscountPaise: number;
  amountPaise: number;
}

export interface ShopProfile {
  name: string;
  address: string;
  phone: string;
  seriesCode: string;
  numberTemplate: string;
  footer: string;
  receiptWidth: ReceiptWidth;
  backupFolder: string;
  /** Heading printed on every bill; "Estimate" until feature 008 (research D23). */
  docTitle: string;
  /** Round the grand total to the nearest rupee (FR-010a). */
  roundBillTotal: boolean;
  /** Named zone for the business date and financial year (FR-019a), for example Asia/Kolkata. */
  timeZone: string;
}

// ---------- command inputs ----------
export const itemsListInput = z.object({
  query: z.string().max(120).optional(),
  includeInactive: z.boolean().optional(),
  needsCorrection: z.boolean().optional(),
  limit: z.number().int().min(1).max(1000),
  offset: z.number().int().min(0),
});
export type ItemsListInput = z.infer<typeof itemsListInput>;

const itemName = z.string().trim().min(1, "Name is required").max(120);
const unitName = z.string().trim().min(1, "Unit is required").max(20);

export const itemsCreateInput = z.object({
  name: itemName,
  unit: unitName,
  allowsDecimal: z.boolean().optional(),
  pricePaise: nonNegPaise,
  openingQtyMilli: qtyMilli.min(0),
  /** The user chose to keep a duplicate name after the warning. Not allowed: must rename. */
});
export type ItemsCreateInput = z.infer<typeof itemsCreateInput>;

export const itemsUpdateInput = z.object({
  id: z.string().min(1),
  name: itemName.optional(),
  unit: unitName.optional(),
  pricePaise: nonNegPaise.optional(),
  active: z.boolean().optional(),
});
export type ItemsUpdateInput = z.infer<typeof itemsUpdateInput>;

export const stockAdjustInput = z.object({
  itemId: z.string().min(1),
  mode: z.enum(["add", "set"]),
  quantityMilli: qtyMilli,
  note: z.string().max(200),
});
export type StockAdjustInput = z.infer<typeof stockAdjustInput>;

export const importPreviewInput = z.object({ filePath: z.string().min(1) });
export const importCommitInput = z.object({ previewId: z.string().min(1) });

export const draftSaveInput = z.object({ payload: z.unknown() });

export const billLineInput = z.object({
  itemId: z.string().min(1),
  /** In `enteredUom` when it is given (2 rolls = 2000), else in the item's own unit */
  quantityMilli: qtyMilli,
  /** Rupees per the item's own (base) unit, as on its price */
  ratePaise: nonNegPaise,
  lineDiscountPaise: nonNegPaise,
  /** Spec 002 T034: an alternate unit of the item (roll); the main process converts it */
  enteredUom: z.string().trim().min(1).max(20).optional(),
});
export type BillLineInput = z.infer<typeof billLineInput>;

export const billsSaveInput = z.object({
  /** Unique id made when the bill is started; saving the same id twice returns the first bill (no duplicates). */
  clientBillId: z.string().uuid(),
  customerName: z.string().trim().max(80).optional(),
  paymentMode: paymentModeSchema,
  billDiscountPaise: nonNegPaise,
  lines: z.array(billLineInput),
});
export type BillsSaveInput = z.infer<typeof billsSaveInput>;

/** A calendar day as the bill stores it, YYYY-MM-DD (the shop's business date). */
const businessDateText = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Use a date like 2026-12-07")
  .pipe(z.iso.date("Enter a valid calendar date"));

export const billsListInput = z.object({
  number: z.string().max(40).optional(),
  from: businessDateText.optional(),
  to: businessDateText.optional(),
  customer: z.string().max(80).optional(),
  status: z.enum(["posted", "cancelled"]).optional(),
  limit: z.number().int().min(1).max(500),
  offset: z.number().int().min(0),
});
export type BillsListInput = z.infer<typeof billsListInput>;
export const billsGetInput = z.object({ id: z.string().min(1) });
/** An empty reason is refused by the cancel rule (REASON_REQUIRED), not here; 200 characters at most. */
export const billsCancelInput = z.object({ id: z.string().min(1), reason: z.string().max(200) });
export type BillsCancelInput = z.infer<typeof billsCancelInput>;
export const billsPrintInput = z.object({
  id: z.string().min(1),
  target: z.enum(["receipt", "a4", "a5"]),
});
export const billsExportPdfInput = z.object({
  id: z.string().min(1),
  target: z.enum(["receipt", "a4", "a5"]),
  filePath: z.string().min(1),
});

export const settingsUpdateInput = z.object({
  name: z.string().trim().min(1, "Shop name is required").max(80),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(20),
  seriesCode: z.string().trim().min(1).max(8),
  numberTemplate: z.string().trim().min(1).max(40),
  footer: z.string().trim().max(200),
  receiptWidth: z.enum(RECEIPT_WIDTHS),
  backupFolder: z.string().max(1000),
  docTitle: z.string().trim().min(1, "Document title is required").max(30),
  roundBillTotal: z.boolean(),
  timeZone: z.string().refine(isValidTimeZone, "Unknown time zone"),
});
export type SettingsUpdateInput = z.infer<typeof settingsUpdateInput>;

/** The renderer reports the zone the computer is set to; the main process compares it with the shop's. */
export const settingsClockCheckInput = z.object({ deviceTimeZone: z.string().max(64) });
export type SettingsClockCheckInput = z.infer<typeof settingsClockCheckInput>;

export const backupPlanRestoreInput = z.object({
  filePath: z.string().min(1),
  /** The last bill number the owner remembers issuing, to keep numbers unique after the restore (FR-013b). */
  lastIssuedBillNo: z.string().max(40).optional(),
});
export type BackupPlanRestoreInput = z.infer<typeof backupPlanRestoreInput>;

/** What a restore will do to the bill numbers, shown to the owner before they confirm. */
export interface IRestorePreview {
  /** The number the next bill will get after the restore. */
  nextBillNo: string;
  /** Present when numbers will be lost: they are recorded and will never be issued again. */
  gapRecorded?: { seqFrom: number; seqTo: number; isEstimated: boolean };
}

const restorePreview = z.object({
  nextBillNo: z.string().min(1).max(40),
  gapRecorded: z
    .object({
      seqFrom: z.number().int().min(1),
      seqTo: z.number().int().min(1),
      isEstimated: z.boolean(),
    })
    .optional(),
}) satisfies z.ZodType<IRestorePreview>;

/**
 * A restore runs only with the whole plan the owner saw (next number and lost range), so a backup that
 * changed after the check is never applied unseen.
 */
export const backupRestoreInput = backupPlanRestoreInput.extend({
  confirmedPreview: restorePreview,
});
export type BackupRestoreInput = z.infer<typeof backupRestoreInput>;

/** What a restore tells the owner before the app restarts: the plan it is applying. */
export interface IBackupRestoreResult extends IRestorePreview {
  restored: boolean;
}

// ---------- results ----------
export type Result<T> =
  { ok: true; data: T } | { ok: false; code: ErrorCode; message: string; details?: unknown };

export interface BackupStatus {
  lastOkAt: string | null;
  lastError: string | null;
  folder: string;
}
