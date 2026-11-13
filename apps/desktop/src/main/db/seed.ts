import type { DB } from "./connection";
import { newId, nowIso } from "./ids";
import { shopProfile } from "./schema";

export interface Ctx {
  businessId: string;
  shopId: string;
  deviceId: string;
}

/**
 * First run: create the single business, single shop and a default shop profile.
 * The profile row also persists the device id. Returns the context used by repositories.
 */
export function ensureSeed(db: DB): Ctx {
  const existing = db.select().from(shopProfile).get();
  if (existing) {
    return {
      businessId: existing.businessId,
      shopId: existing.shopId,
      deviceId: existing.deviceId,
    };
  }
  const ctx: Ctx = { businessId: newId(), shopId: newId(), deviceId: newId() };
  const now = nowIso();
  db.insert(shopProfile)
    .values({
      id: newId(),
      ...ctx,
      createdAt: now,
      updatedAt: now,
      name: "My Shop",
      address: "",
      phone: "",
      seriesCode: "C1",
      numberTemplate: "{series}/{fy}/{seq}",
      footer: "",
      receiptWidth: "80mm",
      backupFolder: "",
    })
    .run();
  return ctx;
}

export function loadCtx(db: DB): Ctx {
  const row = db.select().from(shopProfile).get();
  if (!row) return ensureSeed(db);
  return { businessId: row.businessId, shopId: row.shopId, deviceId: row.deviceId };
}
