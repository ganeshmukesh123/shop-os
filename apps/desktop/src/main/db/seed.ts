import type { DB, Handle } from "./connection";
import { newId, nowMs } from "./ids";
import { location, shopProfile } from "./schema";

export const SHOP_FLOOR_NAME = "Shop floor";

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
  // One transaction: a half-seeded shop (profile without a shop floor) would block every stock write.
  db.transaction((tx) => insertFirstRunRows(tx, ctx));
  return ctx;
}

function insertFirstRunRows(tx: Handle, ctx: Ctx): void {
  const now = nowMs();
  tx.insert(shopProfile)
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
  tx.insert(location)
    .values({
      id: newId(),
      businessId: ctx.businessId,
      shopId: ctx.shopId,
      createdAt: now,
      updatedAt: now,
      name: SHOP_FLOOR_NAME,
      kind: "shop_floor",
    })
    .run();
}

export function loadCtx(db: DB): Ctx {
  const row = db.select().from(shopProfile).get();
  if (!row) return ensureSeed(db);
  return { businessId: row.businessId, shopId: row.shopId, deviceId: row.deviceId };
}
