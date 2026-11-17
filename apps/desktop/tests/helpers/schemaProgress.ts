/**
 * Which schema tasks have landed (specs/001-shop-os-mvp/tasks.md, Phase 7).
 * `schemaShape.test.ts` describes the whole target schema up front; each group of its tests runs
 * only when the matching flag is true. Flip a flag in the same PR that lands the task, so the
 * suite stays green on every commit and nothing in the target shape is forgotten.
 */
export const SCHEMA_TASK_DONE = {
  /** item split into item_family and item_variant */
  T074: true,
  /** location table, stock_movement reshaped */
  T075: true,
  /** bill header renamed (bill_no, posted, subtotal, total) */
  T076: true,
  /** bill_line reshaped, bill_tender added */
  T077: true,
  /** number_series, epoch-millisecond times, billed_at and business_date */
  T078: false, // switched on by the second half (epoch-millisecond times)
  /** shop settings and the bill's doc_title and round_off_paise */
  T080: false,
  /** bill_number_gap */
  T083: false,
};

export type SchemaTask = keyof typeof SCHEMA_TASK_DONE;
