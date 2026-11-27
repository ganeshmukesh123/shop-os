const PLACEHOLDER = /\{([a-z_]+)\}/g;

/**
 * A display name from a category title template (spec 002 data-model.md "category"):
 * `{brand} {size} {class}` with Supreme, 0.5 in, 4 kg gives "Supreme 0.5 in 4 kg". A missing or
 * blank value, or an unknown placeholder, is left out without a double space. An empty result
 * means nothing was filled in; the caller then uses the family name.
 */
export function renderTitle(
  template: string,
  values: Readonly<Record<string, string | undefined>>,
): string {
  const filledIn = template.replace(PLACEHOLDER, (_placeholder, key: string) =>
    Object.hasOwn(values, key) ? (values[key] ?? "").trim() : "",
  );
  return filledIn.replace(/\s+/g, " ").trim();
}
