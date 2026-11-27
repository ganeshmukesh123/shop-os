import { CoreError } from "../../src/errors";
import { MAX_AXES } from "../../src/catalogue/axisSignature";
import { generateVariantCombinations } from "../../src/catalogue/variantCombinations";

function errorOf(action: () => unknown): CoreError | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof CoreError) return error;
    throw error;
  }
  return undefined;
}

describe("generateVariantCombinations (task T005, FR-001)", () => {
  it("gives 6 combinations for 3 sizes x 2 classes, the first axis changing slowest", () => {
    const combinations = generateVariantCombinations(["size", "class"], {
      size: ["0.5 in", "1 in", "2 in"],
      class: ["4 kg", "6 kg"],
    });

    expect(combinations.map((combination) => combination.axisSignature)).toEqual([
      "class=4 kg|size=0.5 in",
      "class=6 kg|size=0.5 in",
      "class=4 kg|size=1 in",
      "class=6 kg|size=1 in",
      "class=4 kg|size=2 in",
      "class=6 kg|size=2 in",
    ]);
  });

  it("keeps each combination's axes as typed", () => {
    const [first] = generateVariantCombinations(["size", "class"], {
      size: ["0.5 in"],
      class: ["4 kg"],
    });

    expect(first!.axes).toEqual({ size: "0.5 in", class: "4 kg" });
  });

  it("gives one combination with no axes and an empty signature for a one-variant family", () => {
    expect(generateVariantCombinations([], {})).toEqual([{ axes: {}, axisSignature: "" }]);
  });

  it("trims the values and drops repeats", () => {
    const combinations = generateVariantCombinations(["size"], {
      size: [" 1 in", "1 in ", "2 in"],
    });

    expect(combinations.map((combination) => combination.axisSignature)).toEqual([
      "size=1 in",
      "size=2 in",
    ]);
  });

  it("rejects 5 axes with TOO_MANY_AXES and says why", () => {
    const error = errorOf(() =>
      generateVariantCombinations(["size", "gauge", "shade", "colour", "length"], {
        size: ["a"],
        gauge: ["a"],
        shade: ["a"],
        colour: ["a"],
        length: ["a"],
      }),
    );

    expect(error?.code).toBe("TOO_MANY_AXES");
    expect(error?.message).toBe("A family can have at most 4 variant attributes");
    expect(MAX_AXES).toBe(4);
  });

  it("accepts each of the 8 Generic keys plus class and base_type", () => {
    const keys = ["size", "gauge", "shade", "pack_size", "colour", "length", "rating", "brand"];
    const accepted = [...keys, "class", "base_type"].map((key) =>
      generateVariantCombinations([key], { [key]: ["x"] }),
    );

    expect(accepted).toHaveLength(10);
    expect(accepted.every((combinations) => combinations.length === 1)).toBe(true);
  });

  it("rejects an unknown key with UNKNOWN_ATTRIBUTE", () => {
    const error = errorOf(() => generateVariantCombinations(["weight"], { weight: ["5 kg"] }));

    expect(error?.code).toBe("UNKNOWN_ATTRIBUTE");
  });

  it("rejects the same key twice", () => {
    const error = errorOf(() => generateVariantCombinations(["size", "size"], { size: ["a"] }));

    expect(error?.code).toBe("INVALID_FIELD");
  });

  it("rejects an axis that has no values", () => {
    const missing = errorOf(() => generateVariantCombinations(["size"], {}));
    const empty = errorOf(() => generateVariantCombinations(["size"], { size: [] }));

    expect([missing?.code, empty?.code]).toEqual(["INVALID_FIELD", "INVALID_FIELD"]);
  });
});
