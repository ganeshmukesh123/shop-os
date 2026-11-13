import {
  CoreError,
  settingsUpdateInput,
  validateNumberTemplate,
  type ShopProfile,
} from "@shopos/core";
import type { DB } from "../db/connection";
import type { Ctx } from "../db/seed";
import { SettingsRepository } from "../repositories/SettingsRepository";

export class SettingsService {
  private readonly repo: SettingsRepository;
  constructor(db: DB, ctx: Ctx) {
    this.repo = new SettingsRepository(db, ctx);
  }

  get(): ShopProfile {
    return this.repo.get();
  }

  update(raw: ShopProfile): ShopProfile {
    const input = settingsUpdateInput.parse(raw);
    const templateValidation = validateNumberTemplate(input.numberTemplate, input.seriesCode);
    if (!templateValidation.ok) throw new CoreError("INVALID_FIELD", templateValidation.reason);
    return this.repo.update(input);
  }
}
