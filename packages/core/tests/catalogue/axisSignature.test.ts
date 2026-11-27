import { CoreError } from "../../src/errors";
import { AXIS_KEYS, buildAxisSignature } from "../../src/catalogue/axisSignature";

function errorCodeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof CoreError ? error.code : "NOT_A_CORE_ERROR";
  }
  return undefined;
}

describe("buildAxisSignature (task T004, research D2)", () => {
  it("sorts the keys and joins key=value pairs with a pipe", () => {
    expect(buildAxisSignature({ size: "0.5 in", class: "4 kg" })).toBe("class=4 kg|size=0.5 in");
  });

  it("gives the same text whatever order the keys were typed in", () => {
    const sizeFirst = buildAxisSignature({ size: "0.5 in", class: "4 kg" });
    const classFirst = buildAxisSignature({ class: "4 kg", size: "0.5 in" });

    expect(sizeFirst).toBe(classFirst);
  });

  it("gives an empty text when there are no axes, as for every item from 001", () => {
    expect(buildAxisSignature({})).toBe("");
  });

  it("trims the values", () => {
    expect(buildAxisSignature({ size: "  0.5 in ", class: "4 kg  " })).toBe(
      "class=4 kg|size=0.5 in",
    );
  });

  it("accepts base_type and pack_size as keys", () => {
    expect(buildAxisSignature({ base_type: "Pastel", pack_size: "3.6 L" })).toBe(
      "base_type=Pastel|pack_size=3.6 L",
    );
  });

  it("lists the eight Generic attributes plus class and base_type", () => {
    expect([...AXIS_KEYS].sort()).toEqual(
      [
        "base_type",
        "brand",
        "class",
        "colour",
        "gauge",
        "length",
        "pack_size",
        "rating",
        "shade",
        "size",
      ].sort(),
    );
  });

  it("rejects a key that is not an attribute", () => {
    expect(errorCodeOf(() => buildAxisSignature({ weight: "5 kg" }))).toBe("UNKNOWN_ATTRIBUTE");
  });

  it("rejects an empty value, which would make a signature like size=", () => {
    expect(errorCodeOf(() => buildAxisSignature({ size: "   " }))).toBe("INVALID_FIELD");
  });

  it("rejects a value with a pipe, which would blur where one pair ends", () => {
    expect(errorCodeOf(() => buildAxisSignature({ size: "a|class=b" }))).toBe("INVALID_FIELD");
  });
});
