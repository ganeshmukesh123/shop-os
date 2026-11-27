import type { Handle } from "./connection";
import { attributeDef, uom } from "./catalogueSchema";
import { newId, nowMs } from "./ids";

/**
 * The catalogue's system rows (spec 002 data-model.md "Catalogue"). A new shop gets them from the
 * first-run seed; migration 0016 inserts the same values for a shop that already exists. The SQL
 * copy is frozen in the migration; catalogueTables.test.ts proves both give the same rows.
 */
export const SEEDED_ATTRIBUTES = [
  { key: "size", label: "Size", dataType: "text" },
  { key: "gauge", label: "Gauge", dataType: "text" },
  { key: "shade", label: "Shade", dataType: "text" },
  { key: "pack_size", label: "Pack size", dataType: "text" },
  { key: "colour", label: "Colour", dataType: "text" },
  { key: "length", label: "Length", dataType: "text" },
  { key: "rating", label: "Rating", dataType: "text" },
  { key: "brand", label: "Brand", dataType: "text" },
  { key: "class", label: "Class", dataType: "enum" },
  { key: "base_type", label: "Base type", dataType: "enum" },
] as const;

/** UQC codes are not yet confirmed by the CA (research OI-1). */
export const SEEDED_UNITS = [
  { code: "pcs", label: "Pieces", dimension: "count", uqc: "NOS", allowDecimal: 0 },
  { code: "metre", label: "Metre", dimension: "length", uqc: "MTR", allowDecimal: 1 },
  { code: "kg", label: "Kilogram", dimension: "mass", uqc: "KGS", allowDecimal: 1 },
  { code: "litre", label: "Litre", dimension: "volume", uqc: "LTR", allowDecimal: 1 },
  { code: "ml", label: "Millilitre", dimension: "volume", uqc: "MLT", allowDecimal: 1 },
  { code: "box", label: "Box", dimension: "count", uqc: "BOX", allowDecimal: 0 },
  { code: "roll", label: "Roll", dimension: "count", uqc: "ROL", allowDecimal: 0 },
  { code: "pair", label: "Pair", dimension: "count", uqc: "PRS", allowDecimal: 0 },
  { code: "bundle", label: "Bundle", dimension: "count", uqc: "BDL", allowDecimal: 0 },
] as const;

/** Insert the seeded attributes and units for a new shop, inside the first-run transaction. */
export function insertCatalogueSeed(
  transaction: Handle,
  shop: { businessId: string; shopId: string },
): void {
  const now = nowMs();
  const stamp = { ...shop, createdAt: now, updatedAt: now };
  transaction
    .insert(attributeDef)
    .values(SEEDED_ATTRIBUTES.map((attribute) => ({ id: newId(), ...stamp, ...attribute })))
    .run();
  transaction
    .insert(uom)
    .values(SEEDED_UNITS.map((unit) => ({ id: newId(), ...stamp, ...unit })))
    .run();
}
