const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Puts named values into a screen text, so a translation can change the word order.
 * Example: fillText("{name} saved", { name: "Pipe 20mm" }) gives "Pipe 20mm saved".
 */
export function fillText(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(PLACEHOLDER, (placeholder, valueName: string) =>
    Object.hasOwn(values, valueName) ? String(values[valueName]) : placeholder,
  );
}
