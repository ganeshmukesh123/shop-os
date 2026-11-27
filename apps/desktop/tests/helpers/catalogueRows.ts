import type Database from "better-sqlite3";
import { newId } from "../../src/main/db/ids";

/** The shop's business and shop ids, read from its profile row. */
export const shopIdsOf = (sqlite: Database.Database) =>
  sqlite.prepare("select business_id as businessId, shop_id as shopId from shop_profile").get() as {
    businessId: string;
    shopId: string;
  };

/** Insert one row with the base columns filled in; `columns` override or add to them. */
export function insertCatalogueRow(
  sqlite: Database.Database,
  table: string,
  columns: Record<string, unknown>,
): string {
  const { businessId, shopId } = shopIdsOf(sqlite);
  const rowId = newId();
  const allColumns = {
    id: rowId,
    business_id: businessId,
    shop_id: shopId,
    created_at: 1,
    updated_at: 1,
    ...columns,
  };
  const names = Object.keys(allColumns);
  sqlite
    .prepare(
      `insert into ${table} (${names.join(", ")}) values (${names.map(() => "?").join(", ")})`,
    )
    .run(...Object.values(allColumns));
  return String(allColumns.id);
}

/** A "PVC Pipe" family with one variant, 1 inch, base unit metre; returns the variant id. */
export function insertPipeVariant(sqlite: Database.Database): string {
  const familyId = insertCatalogueRow(sqlite, "item_family", { name: "PVC Pipe" });
  return insertCatalogueRow(sqlite, "item_variant", {
    family_id: familyId,
    item_code: `ITM-${familyId}`,
    display_name: "PVC Pipe 1 inch",
    base_uom: "metre",
    allow_decimal: 1,
    selling_price_paise: 12_000,
  });
}
