import {
  CoreError,
  isValidBarcode,
  type IBarcode,
  type IBarcodeShare,
  type ISearchName,
  type VariantsSetBarcodesInput,
  type VariantsSetSearchNamesInput,
} from "@shopos/core";
import type { DB, Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { BarcodeRepository } from "../../repositories/BarcodeRepository";
import { ExceptionRepository } from "../../repositories/ExceptionRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { SearchNameRepository } from "../../repositories/SearchNameRepository";
import { finalSurvivorOf } from "../barcode";
import type { SearchService } from "../search";

export type IVariantCodesSearch = Pick<SearchService, "refreshVariant">;

/** A variant that exists and is not merged: a merged variant's retained rows cannot be edited (D6). */
function requireEditable(families: FamilyRepository, variantId: string): void {
  const variant = families.getVariant(variantId);
  if (!variant) throw new CoreError("NOT_FOUND", "This item is not here any more");
  if (variant.mergedIntoId !== null) {
    throw new CoreError("ALREADY_MERGED", "This item is merged into another; edit that one");
  }
}

/** variants.setBarcodes and variants.setSearchNames (spec 002 T047). Search re-reads after commit. */
export class VariantCodesService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
    private readonly search?: IVariantCodesSearch,
  ) {}

  setBarcodes(input: VariantsSetBarcodesInput): {
    barcodes: IBarcode[];
    sharedWith: IBarcodeShare[];
  } {
    const badCode = input.barcodes.find(({ code }) => !isValidBarcode(code));
    if (badCode) {
      throw new CoreError(
        "INVALID_BARCODE",
        `"${badCode.code}" is not a barcode: use 1 to 48 digits, letters or hyphens`,
      );
    }
    const result = this.db.transaction((transaction) => {
      requireEditable(new FamilyRepository(transaction, this.ctx), input.variantId);
      const barcodes = new BarcodeRepository(transaction, this.ctx);
      barcodes.replaceFor(input.variantId, input.barcodes);
      return {
        barcodes: barcodes.listFor(input.variantId),
        sharedWith: this.reportShared(transaction, input.variantId),
      };
    });
    this.search?.refreshVariant(input.variantId);
    return result;
  }

  setSearchNames(input: VariantsSetSearchNamesInput): { searchNames: ISearchName[] } {
    const result = this.db.transaction((transaction) => {
      const families = new FamilyRepository(transaction, this.ctx);
      input.variantIds.forEach((variantId) => requireEditable(families, variantId));
      const names = new SearchNameRepository(transaction, this.ctx);
      input.variantIds.forEach((variantId) => names.replaceFor(variantId, input.names));
      return { searchNames: names.listFor(input.variantIds) };
    });
    input.variantIds.forEach((variantId) => this.search?.refreshVariant(variantId));
    return result;
  }

  /** Other items (after following merges) holding the variant's codes; one open issue per code. */
  private reportShared(handle: Handle, variantId: string): IBarcodeShare[] {
    const families = new FamilyRepository(handle, this.ctx);
    const barcodes = new BarcodeRepository(handle, this.ctx);
    const issues = new ExceptionRepository(handle, this.ctx);
    return barcodes.listFor(variantId).flatMap(({ code }) => {
      const others = [
        ...new Set(barcodes.ownersOf(code).map((ownerId) => finalSurvivorOf(families, ownerId))),
      ].filter((ownerId) => ownerId !== variantId);
      if (others.length > 0) {
        issues.openOnce({
          kind: "duplicate_barcode",
          subjectIds: [variantId, ...others],
          detail: code,
        });
      }
      return others.map((otherId) => ({
        code,
        variantId: otherId,
        displayName: families.getVariant(otherId)?.displayName ?? "",
      }));
    });
  }
}
