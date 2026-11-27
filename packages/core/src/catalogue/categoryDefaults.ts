/** The defaults a category gives a new family; empty means "take the parent's". */
export interface ICategoryDefaults {
  defaultHsn: string | null;
  defaultBaseUom: string | null;
  titleTemplate: string | null;
}

const isFilled = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value.trim() !== "";

/**
 * A category's effective defaults (spec 002 data-model.md "category"): each empty field comes
 * from the nearest ancestor that has it. `categoryPath` runs from the top category down to the
 * family's own; an empty path is an uncategorised family with no defaults.
 */
export function resolveCategoryDefaults(
  categoryPath: readonly Readonly<ICategoryDefaults>[],
): ICategoryDefaults {
  const nearestFirst = [...categoryPath].reverse();
  const nearestValue = (field: keyof ICategoryDefaults) =>
    nearestFirst.map((category) => category[field]).find(isFilled) ?? null;
  return {
    defaultHsn: nearestValue("defaultHsn"),
    defaultBaseUom: nearestValue("defaultBaseUom"),
    titleTemplate: nearestValue("titleTemplate"),
  };
}
