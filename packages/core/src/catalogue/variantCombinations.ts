import { CoreError } from "../errors";
import { MAX_AXES, buildAxisSignature, cleanAxisValue, isAxisKey } from "./axisSignature";

export interface IVariantCombination {
  axes: Record<string, string>;
  axisSignature: string;
}

function assertValidAxisKeys(axisKeys: readonly string[]): void {
  if (axisKeys.length > MAX_AXES) {
    throw new CoreError(
      "TOO_MANY_AXES",
      `A family can have at most ${MAX_AXES} variant attributes`,
    );
  }
  const unknownKey = axisKeys.find((key) => !isAxisKey(key));
  if (unknownKey !== undefined) {
    throw new CoreError("UNKNOWN_ATTRIBUTE", `${unknownKey} is not a variant attribute`);
  }
  if (new Set(axisKeys).size !== axisKeys.length) {
    throw new CoreError("INVALID_FIELD", "Each variant attribute can be used only once");
  }
}

/** The values chosen for one axis: trimmed, repeats dropped, at least one. */
function chosenValues(key: string, rawValues: readonly string[] | undefined): string[] {
  const axisValues = [
    ...new Set((rawValues ?? []).map((rawValue) => cleanAxisValue(key, rawValue))),
  ];
  if (axisValues.length === 0) {
    throw new CoreError("INVALID_FIELD", `Pick at least one value for ${key}`);
  }
  return axisValues;
}

/**
 * Every combination of the chosen values, in grid order: the first axis changes slowest (it becomes
 * the grid's rows), the last changes fastest. With no axes there is one combination with no axes.
 */
export function generateVariantCombinations(
  axisKeys: readonly string[],
  axisValues: Readonly<Record<string, readonly string[]>>,
): IVariantCombination[] {
  assertValidAxisKeys(axisKeys);
  let combinations: Record<string, string>[] = [{}];
  for (const key of axisKeys) {
    const values = chosenValues(key, axisValues[key]);
    combinations = combinations.flatMap((axes) =>
      values.map((axisValue) => ({ ...axes, [key]: axisValue })),
    );
  }
  return combinations.map((axes) => ({ axes, axisSignature: buildAxisSignature(axes) }));
}
