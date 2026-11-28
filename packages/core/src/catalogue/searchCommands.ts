import { z } from "zod";
import type { SearchTier } from "../search/rankSearchMatches";
import type { Item } from "../types";
import type { IGridTab } from "./variantGrid";
import type { FamilyKind } from "./variantDraft";

/** items.search and families.grid (spec 002 contracts, T038). */
export const itemsSearchInput = z.object({
  query: z.string().max(80),
  limit: z.number().int().min(1).max(50),
});
export type ItemsSearchInput = z.infer<typeof itemsSearchInput>;

export const familiesGridInput = z.object({ familyId: z.string().min(1) });
export type FamiliesGridInput = z.infer<typeof familiesGridInput>;

/** One search result: a variant (billable as it is) or a family of several (opens the grid). */
export interface IItemSearchRow {
  kind: "variant" | "family";
  /** For a family row: its kind, so a base paint opens the tinting desk (spec 002 T064) */
  familyKind?: FamilyKind;
  id: string;
  displayName: string;
  matchedBy: SearchTier;
  /** A family's is the sum of its active variants' stock */
  stockMilli: number;
  /** A family's is its lowest variant price, shown as "from" */
  pricePaise: number;
  /** The variant as the bill needs it; null for a family row */
  item: Item | null;
}

/** A family laid out for the bill (research D15), with its variants as billable items. */
export interface IFamilyGrid {
  axisKeys: string[];
  tabs: IGridTab[];
  items: Item[];
}
