import {
  CoreError,
  tintChargesSaveInput,
  tintCustomShadeSaveInput,
  tintSaveVersionInput,
  tintShadesSearchInput,
  tintRepeatListInput,
  tintResolveInput,
  type ITintRepeat,
  type ITintResolved,
  type TintRepeatListInput,
  type TintResolveInput,
  type ITintChargeRow,
  type ITintFormula,
  type ITintShade,
  type TintChargesSaveInput,
  type TintCustomShadeSaveInput,
  type TintSaveVersionInput,
  type TintShadesSearchInput,
} from "@shopos/core";
import type { DB } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { TintChargeRepository, TintRepository } from "../../repositories/TintRepository";
import { customShadeLabels, requireTintable } from "./tintChecks";
import { repeatList } from "./tintRepeat";
import { resolveTint } from "./tintResolve";

/** A custom shade's code: C-0001, C-0002 and so on (shade_code is 1 to 20 characters). */
const customShadeCode = (count: number) => `C-${String(count + 1).padStart(4, "0")}`;

/**
 * Shades, versioned formulas and tint charges (spec 002 T060, research D11). A formula is never
 * edited: a change is a new version, and the current formula is the highest version.
 */
export class TintService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  searchShades(raw: TintShadesSearchInput): { shades: ITintShade[] } {
    const input = tintShadesSearchInput.parse(raw);
    return {
      shades: new TintRepository(this.db, this.ctx).searchShades(input.query.trim(), input.brandId),
    };
  }

  currentFormula(shadeId: string, baseVariantId: string): ITintFormula | null {
    const versions = new TintRepository(this.db, this.ctx).formulasFor(shadeId, [baseVariantId]);
    return versions.reduce<ITintFormula | null>(
      (highest, formula) => (!highest || formula.version > highest.version ? formula : highest),
      null,
    );
  }

  /** tint.formula.saveVersion: the next version for this shade and base can. */
  saveVersion(raw: TintSaveVersionInput): { formula: ITintFormula } {
    const input = tintSaveVersionInput.parse(raw);
    return this.db.transaction((transaction) => {
      const tints = new TintRepository(transaction, this.ctx);
      if (!tints.getShade(input.shadeId))
        throw new CoreError("NOT_FOUND", "This shade is not here any more");
      requireTintable(
        new FamilyRepository(transaction, this.ctx),
        input.baseVariantId,
        input.lines,
      );
      const version = tints.highestVersion(input.shadeId, input.baseVariantId) + 1;
      return { formula: tints.insertFormula({ ...input, version }) };
    });
  }

  /** tint.customShade.save: a shade mixed for a customer or a site, with its first formula. */
  saveCustomShade(raw: TintCustomShadeSaveInput): { shade: ITintShade; formula: ITintFormula } {
    const input = tintCustomShadeSaveInput.parse(raw);
    const labels = customShadeLabels(input.customerLabel, input.siteLabel);
    return this.db.transaction((transaction) => {
      requireTintable(
        new FamilyRepository(transaction, this.ctx),
        input.baseVariantId,
        input.lines,
      );
      const tints = new TintRepository(transaction, this.ctx);
      const shade = tints.insertShade({
        shadeCode: customShadeCode(tints.countCustomShades()),
        shadeName: input.shadeName,
        brandId: null,
        shadeCard: null,
        source: "custom",
        ...labels,
      });
      const formula = tints.insertFormula({
        shadeId: shade.id,
        baseVariantId: input.baseVariantId,
        version: 1,
        lines: input.lines,
      });
      return { shade, formula };
    });
  }

  /** tint.resolve: the can, formula, colorant amounts and price for the desk. */
  resolve(raw: TintResolveInput): ITintResolved {
    return resolveTint(this.db, this.ctx, tintResolveInput.parse(raw));
  }

  /** tint.repeat.list: a customer's or site's shades, newest first. */
  repeatList(raw: TintRepeatListInput): { shades: ITintRepeat[] } {
    return { shades: repeatList(this.db, this.ctx, tintRepeatListInput.parse(raw)) };
  }

  listCharges(): { rules: ITintChargeRow[] } {
    return { rules: new TintChargeRepository(this.db, this.ctx).listCharges() };
  }

  saveCharges(raw: TintChargesSaveInput): { rules: ITintChargeRow[] } {
    const input = tintChargesSaveInput.parse(raw);
    return this.db.transaction((transaction) => {
      const charges = new TintChargeRepository(transaction, this.ctx);
      charges.replaceCharges(input.rules);
      return { rules: charges.listCharges() };
    });
  }
}
