import { integer, text } from "drizzle-orm/sqlite-core";

/** Columns every table carries (data-model.md conventions). */
export const base = {
  id: text("id").primaryKey(), // UUID v7
  businessId: text("business_id").notNull(),
  shopId: text("shop_id").notNull(),
  // UTC instants as epoch milliseconds (integer), never text
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
};
