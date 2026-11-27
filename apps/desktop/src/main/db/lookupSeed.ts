import type { Handle } from "./connection";
import { newId, nowMs } from "./ids";
import {
  exceptionKind,
  movementDocType,
  movementType,
  tenderMode,
  tenderStatus,
} from "./lookupSchema";
import { location } from "./stockSchema";

/**
 * The lookup rows of research D17 (spec 002 T019). A new shop gets them here in the first-run
 * transaction; migration 0019 inserts the same values for a shop that already exists, and
 * lookupTables.test.ts proves both give the same rows.
 */
export const SEEDED_MOVEMENT_DOC_TYPES = ["bill", "item_merge"] as const;
export const SEEDED_TENDER_MODES = ["cash", "upi", "card", "unpaid"] as const;
export const SEEDED_TENDER_STATUSES = ["label"] as const;
export const SEEDED_EXCEPTION_KINDS = ["duplicate_barcode", "duplicate_suspect"] as const;

export const SEEDED_MOVEMENT_TYPES = [
  { code: "opening", direction: "in", requiresDoc: 0, requiredDocType: null, requiresReason: 0 },
  {
    code: "adjustment",
    direction: "either",
    requiresDoc: 0,
    requiredDocType: null,
    requiresReason: 1,
  },
  { code: "sale", direction: "out", requiresDoc: 1, requiredDocType: "bill", requiresReason: 0 },
  {
    code: "sale_cancel",
    direction: "in",
    requiresDoc: 1,
    requiredDocType: "bill",
    requiresReason: 0,
  },
  {
    code: "merge_in",
    direction: "in",
    requiresDoc: 1,
    requiredDocType: "item_merge",
    requiresReason: 0,
  },
  {
    code: "merge_out",
    direction: "out",
    requiresDoc: 1,
    requiredDocType: "item_merge",
    requiresReason: 0,
  },
] as const;

export const TINTED_RETURNS_NAME = "Tinted returns";

/** Insert the lookup rows and the "Tinted returns" location for a new shop. */
export function insertLookupSeed(
  transaction: Handle,
  shop: { businessId: string; shopId: string },
): void {
  const now = nowMs();
  const stamp = { ...shop, createdAt: now, updatedAt: now };
  const codeRows = (codes: readonly string[]) =>
    codes.map((code) => ({ id: newId(), ...stamp, code }));
  transaction.insert(movementDocType).values(codeRows(SEEDED_MOVEMENT_DOC_TYPES)).run();
  transaction
    .insert(movementType)
    .values(SEEDED_MOVEMENT_TYPES.map((typeRow) => ({ id: newId(), ...stamp, ...typeRow })))
    .run();
  transaction.insert(tenderMode).values(codeRows(SEEDED_TENDER_MODES)).run();
  transaction.insert(tenderStatus).values(codeRows(SEEDED_TENDER_STATUSES)).run();
  transaction.insert(exceptionKind).values(codeRows(SEEDED_EXCEPTION_KINDS)).run();
  transaction
    .insert(location)
    .values({ id: newId(), ...stamp, name: TINTED_RETURNS_NAME, kind: "tinted_returns" })
    .run();
}
