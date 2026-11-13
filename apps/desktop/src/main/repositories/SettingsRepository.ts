import { eq } from "drizzle-orm";
import type { ReceiptWidth, ShopProfile } from "@shopos/core";
import type { Handle } from "../db/connection";
import { nowIso } from "../db/ids";
import { shopProfile } from "../db/schema";
import type { Ctx } from "../db/seed";

export class SettingsRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  get(): ShopProfile {
    const profileRow = this.databaseHandle
      .select()
      .from(shopProfile)
      .where(eq(shopProfile.shopId, this.ctx.shopId))
      .get();
    if (!profileRow) throw new Error("shop profile missing: first-run seed has not run");
    return {
      name: profileRow.name,
      address: profileRow.address,
      phone: profileRow.phone,
      seriesCode: profileRow.seriesCode,
      numberTemplate: profileRow.numberTemplate,
      footer: profileRow.footer,
      receiptWidth: profileRow.receiptWidth as ReceiptWidth,
      backupFolder: profileRow.backupFolder,
    };
  }

  update(newProfile: ShopProfile): ShopProfile {
    this.databaseHandle
      .update(shopProfile)
      .set({ ...newProfile, updatedAt: nowIso() })
      .where(eq(shopProfile.shopId, this.ctx.shopId))
      .run();
    return this.get();
  }
}
