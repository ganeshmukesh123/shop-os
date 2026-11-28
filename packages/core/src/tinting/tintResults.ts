import type { IVariant } from "../catalogue/familyTypes";
import type { ITintFormula, ITintFormulaLine } from "./resolveTintFormula";
import type { ITintShade } from "./tintCommands";

/** tint.resolve: everything the tinting desk shows for one can (contracts, FR-014, FR-015). */
export interface ITintResolved {
  baseVariant: IVariant;
  formula: ITintFormula;
  /** Per can, with the colorant's stock now (on its survivor) */
  lines: { colorantVariantId: string; name: string; qtyMilli: number; stockMilli: number }[];
  unitPricePaise: number;
  chargePaise: number;
  /** Null when the base's purchase price is not known */
  costPaise: number | null;
}

/** tint.repeat.list: one shade the customer or site had, newest first. */
export interface ITintRepeat {
  shade: ITintShade;
  formula: ITintFormula;
  /** When it was last billed (epoch ms), or null for a custom shade never billed */
  lastBilledAt: number | null;
  baseVariant: IVariant;
  /** For a billed shade: the line to repeat, with its saved amounts */
  sourceBillLineId?: string;
  /** Per can; the name is the billed snapshot's, or the colorant's for an unbilled shade */
  lines: (ITintFormulaLine & { name: string })[];
}
