import { buildAxisSignature } from "../catalogue/axisSignature";
import {
  findLikelyDuplicates,
  type IDuplicateCandidate,
  type ILikelyDuplicate,
} from "../search/likelyDuplicates";
import type { IImportFamily } from "./itemImportRows";

/** Rows that look like the same item: each other's twins in the file, or an item already saved. */
export interface IDuplicateGroup {
  rows: number[];
  existing: ILikelyDuplicate[];
}

/** A variant's full name, as the shop sees it: "PVC Pipe 1 in". */
const fullNameOf = (familyName: string, axes: Record<string, string>) =>
  [familyName, ...Object.values(axes)].join(" ").trim();

/**
 * Duplicate groups of an import (spec 002 T070, FR-008): rows with the same family name (ignoring
 * case) and attribute values, then each other row that findLikelyDuplicates matches to items the
 * shop already has. The preview lists them; the owner decides.
 */
export function findImportDuplicates(
  families: readonly IImportFamily[],
  existing: readonly IDuplicateCandidate[],
): IDuplicateGroup[] {
  const variants = families.flatMap((family) =>
    family.variants.map((variant) => ({
      rowNumber: variant.rowNumber,
      name: fullNameOf(family.name, variant.axes),
      key: `${family.name.toLowerCase()}|${buildAxisSignature(variant.axes)}`,
      axisSignature: buildAxisSignature(variant.axes),
    })),
  );
  const rowsByKey = new Map<string, number[]>();
  variants.forEach((variant) =>
    rowsByKey.set(variant.key, [...(rowsByKey.get(variant.key) ?? []), variant.rowNumber]),
  );
  const twins = [...rowsByKey.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => ({ rows, existing: [] }));
  const inTwins = new Set(twins.flatMap(({ rows }) => rows));
  const likeSaved = variants
    .filter((variant) => !inTwins.has(variant.rowNumber))
    .map((variant) => ({
      rows: [variant.rowNumber],
      existing: findLikelyDuplicates(
        {
          name: variant.name,
          brandId: null,
          categoryId: null,
          axisSignature: variant.axisSignature,
        },
        existing,
      ),
    }))
    .filter((group) => group.existing.length > 0);
  return [...twins, ...likeSaved];
}
