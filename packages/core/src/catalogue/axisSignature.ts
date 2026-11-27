import { CoreError } from "../errors";

/** The attributes a variant axis can use: the eight Generic ones, plus class and base_type (D1). */
export const AXIS_KEYS = [
  "size",
  "gauge",
  "shade",
  "pack_size",
  "colour",
  "length",
  "rating",
  "brand",
  "class",
  "base_type",
] as const;
export type AxisKey = (typeof AXIS_KEYS)[number];

/** A family has at most this many axes (FR-001). */
export const MAX_AXES = 4;

const PAIR_SEPARATOR = "|";

export function isAxisKey(key: string): key is AxisKey {
  return (AXIS_KEYS as readonly string[]).includes(key);
}

/** The trimmed value of one axis, or an error if it is empty or would blur the signature text. */
export function cleanAxisValue(key: string, rawValue: string): string {
  const axisValue = rawValue.trim();
  if (axisValue === "") {
    throw new CoreError("INVALID_FIELD", `The value for ${key} cannot be empty`);
  }
  if (axisValue.includes(PAIR_SEPARATOR)) {
    throw new CoreError("INVALID_FIELD", `The value for ${key} cannot contain "|"`);
  }
  return axisValue;
}

/**
 * The canonical text of a variant's axes: keys sorted, `key=value` pairs joined by `|`, for example
 * `class=4 kg|size=0.5 in`. A one-variant family (every item from 001) has no axes and gives `''`.
 */
export function buildAxisSignature(axes: Readonly<Record<string, string>>): string {
  const sortedKeys = Object.keys(axes).sort();
  const pairs = sortedKeys.map((key) => {
    if (!isAxisKey(key)) {
      throw new CoreError("UNKNOWN_ATTRIBUTE", `${key} is not a variant attribute`);
    }
    return `${key}=${cleanAxisValue(key, axes[key]!)}`;
  });
  return pairs.join(PAIR_SEPARATOR);
}
