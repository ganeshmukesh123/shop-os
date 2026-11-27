import {
  CoreError,
  findClockWarnings,
  settingsSetThemeInput,
  settingsUpdateInput,
  validateNumberTemplate,
  type ClockWarning,
  type SavedTheme,
  type SettingsSetThemeInput,
  type ShopProfile,
  type ThemePreference,
} from "@shopos/core";
import type { DB } from "../db/connection";
import type { Ctx } from "../db/seed";
import { BillClockRepository } from "../repositories/BillClockRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";

export class SettingsService {
  private readonly repo: SettingsRepository;
  private readonly billClock: BillClockRepository;
  constructor(db: DB, ctx: Ctx) {
    this.repo = new SettingsRepository(db, ctx);
    this.billClock = new BillClockRepository(db, ctx);
  }

  get(): ShopProfile {
    return this.repo.get();
  }

  update(raw: ShopProfile): ShopProfile {
    const input = settingsUpdateInput.parse(raw);
    const templateValidation = validateNumberTemplate(
      input.numberTemplate,
      input.seriesCode,
      new Date(),
      input.timeZone,
    );
    if (!templateValidation.ok) throw new CoreError("INVALID_FIELD", templateValidation.reason);
    return this.repo.update(input);
  }

  getTheme(): SavedTheme {
    return this.repo.getTheme();
  }

  setTheme(raw: SettingsSetThemeInput): { theme: ThemePreference } {
    return this.repo.setTheme(settingsSetThemeInput.parse(raw).theme);
  }

  /**
   * Warnings, never an error: the computer's zone is not the shop's, or its clock is earlier than the
   * newest saved bill (FR-019a). Billing carries on either way.
   */
  clockCheck(deviceTimeZone: string, now: Date = new Date()): { warnings: ClockWarning[] } {
    const warnings = findClockWarnings({
      deviceTimeZone,
      shopTimeZone: this.repo.get().timeZone,
      nowMs: now.getTime(),
      lastBilledAtMs: this.billClock.lastBilledAt(),
    });
    return { warnings };
  }
}
