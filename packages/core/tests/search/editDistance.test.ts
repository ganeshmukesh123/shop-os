import { editDistance, editDistanceWithin } from "../../src/search/editDistance";

describe("editDistance (task T007, Damerau-Levenshtein)", () => {
  it("counts a swap of two neighbouring letters as one edit", () => {
    expect(editDistance("elbow", "elbwo")).toBe(1);
  });

  it("counts a delete and a substitution as two edits", () => {
    expect(editDistance("paipa", "pipe")).toBe(2);
  });

  it("is zero for the same text and the text's length against an empty one", () => {
    expect(editDistance("pipe", "pipe")).toBe(0);
    expect(editDistance("pipe", "")).toBe(4);
    expect(editDistance("", "pipe")).toBe(4);
  });

  it("counts an insert as one edit and does not care which side is longer", () => {
    expect(editDistance("pipe", "pipes")).toBe(1);
    expect(editDistance("pipes", "pipe")).toBe(1);
  });

  it("compares Devanagari letters one at a time", () => {
    expect(editDistance("पाइप", "पाइपा")).toBe(1);
  });
});

describe("editDistanceWithin", () => {
  it("gives the distance when it is within the limit", () => {
    expect(editDistanceWithin("elbow", "elbwo", 1)).toBe(1);
    expect(editDistanceWithin("paipa", "pipe", 2)).toBe(2);
    expect(editDistanceWithin("pipe", "pipe", 0)).toBe(0);
  });

  it("gives null when the distance is above the limit", () => {
    expect(editDistanceWithin("paipa", "pipe", 1)).toBeNull();
    expect(editDistanceWithin("pipe", "pipes", 0)).toBeNull();
  });

  it("gives null at once when the lengths are too far apart to be within the limit", () => {
    expect(editDistanceWithin("a", "a".repeat(5000), 2)).toBeNull();
  });

  it("gives null for two long different texts and agrees with the full distance when close", () => {
    const longText = "abcdefghij".repeat(300);
    const otherText = "klmnopqrst".repeat(300);
    const nearText = `${longText.slice(0, 1000)}x${longText.slice(1000)}`;

    expect(editDistanceWithin(longText, otherText, 2)).toBeNull();
    expect(editDistanceWithin(longText, nearText, 2)).toBe(editDistance(longText, nearText));
  });
});
