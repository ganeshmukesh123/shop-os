import type { SchemaTask } from "./schemaProgress";

/** The target schema of specs/001-shop-os-mvp/data-model.md, grouped by the task that builds it. */
export interface ISchemaStep {
  task: SchemaTask;
  presentColumns: Record<string, string[]>;
  absentColumns: Record<string, string[]>;
  removedTables: string[];
}

export const SCHEMA_STEPS: ISchemaStep[] = [
  {
    task: "T074",
    presentColumns: {
      item_family: ["name"],
      item_variant: [
        "family_id",
        "item_code",
        "display_name",
        "base_uom",
        "allow_decimal",
        "selling_price_paise",
        "is_active",
        "stock_milli",
        "hsn_code",
        "gst_rate_override_bp",
        "barcode",
      ],
    },
    absentColumns: {},
    removedTables: ["item"],
  },
  {
    task: "T075",
    presentColumns: {
      location: ["name", "kind"],
      stock_movement: [
        "variant_id",
        "movement_type",
        "qty_base_milli",
        "from_location_id",
        "to_location_id",
        "doc_type",
        "doc_id",
        "reason_code",
        "note",
        "device_id",
        "occurred_at",
      ],
    },
    absentColumns: { stock_movement: ["item_id", "quantity_milli", "reason", "bill_id"] },
    removedTables: [],
  },
  {
    task: "T076",
    presentColumns: {
      bill: ["bill_no", "device_id", "counter_code", "subtotal_paise", "total_paise"],
    },
    absentColumns: { bill: ["number", "series_code", "lines_total_paise", "grand_total_paise"] },
    removedTables: [],
  },
  {
    task: "T077",
    presentColumns: {
      bill_line: [
        "bill_id",
        "line_no",
        "variant_id",
        "item_name_snapshot",
        "unit_snapshot",
        "qty_base_milli",
        "unit_price_paise",
        "line_discount_paise",
        "amount_paise",
      ],
      bill_tender: ["bill_id", "mode", "amount_paise", "status"],
    },
    absentColumns: {
      bill: ["payment_mode"],
      bill_line: ["item_id", "quantity_milli", "rate_paise"],
    },
    removedTables: [],
  },
  {
    task: "T078",
    presentColumns: {
      number_series: ["counter_code", "financial_year", "template", "last_seq"],
      bill: ["number_series_id", "billed_at", "business_date"],
    },
    absentColumns: { bill: ["bill_date"] },
    removedTables: ["number_counter"],
  },
  {
    task: "T080",
    presentColumns: {
      shop_profile: ["doc_title", "round_bill_total", "time_zone", "receipt_width"],
      bill: ["doc_title", "round_off_paise"],
    },
    absentColumns: {},
    removedTables: [],
  },
  {
    task: "T083",
    presentColumns: {
      bill_number_gap: ["number_series_id", "seq_from", "seq_to", "reason", "recorded_at"],
    },
    absentColumns: {},
    removedTables: [],
  },
];
