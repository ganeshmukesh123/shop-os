import {
  findLikelyDuplicates,
  trigramSimilarity,
  type IDuplicateCandidate,
} from "../../src/search/likelyDuplicates";

/** Spec 002 T041 (research D5, FR-008): likely duplicates shown before a new item is saved. */
const PIPE_HALF_INCH: IDuplicateCandidate = {
  variantId: "pipe-half",
  displayName: "PVC Pipe Supreme 0.5 in 4 kg",
  brandId: "supreme",
  categoryId: "pipes",
  axisSignature: "class=4 kg|size=0.5 in",
};
const ELBOW: IDuplicateCandidate = {
  variantId: "elbow",
  displayName: "Elbow 1 inch",
  brandId: null,
  categoryId: null,
  axisSignature: "",
};

describe("findLikelyDuplicates (spec 002 T041)", () => {
  it("flags the same brand, category and attribute values, whatever the name", () => {
    const found = findLikelyDuplicates(
      {
        name: "Supreme pipe",
        brandId: "supreme",
        categoryId: "pipes",
        axisSignature: "class=4 kg|size=0.5 in",
      },
      [PIPE_HALF_INCH],
    );

    expect(found).toEqual([
      {
        variantId: "pipe-half",
        displayName: "PVC Pipe Supreme 0.5 in 4 kg",
        reason: "same_attributes",
      },
    ]);
  });

  it("flags a name within 2 typing mistakes, ignoring case and punctuation", () => {
    const found = findLikelyDuplicates(
      { name: "elbow-1 inhc", brandId: null, categoryId: null, axisSignature: "" },
      [ELBOW],
    );

    expect(found).toEqual([
      { variantId: "elbow", displayName: "Elbow 1 inch", reason: "similar_name" },
    ]);
  });

  it("flags the same words in another order through shared trigrams", () => {
    const found = findLikelyDuplicates(
      {
        name: "Supreme PVC Pipe 0.5 in 4 kg",
        brandId: "other",
        categoryId: null,
        axisSignature: "x",
      },
      [PIPE_HALF_INCH],
    );

    expect(found.map((candidate) => candidate.reason)).toEqual(["similar_name"]);
  });

  it("does not flag a different brand with a different name", () => {
    const found = findLikelyDuplicates(
      {
        name: "Gate valve brass",
        brandId: "zoloto",
        categoryId: "valves",
        axisSignature: "size=1 in",
      },
      [PIPE_HALF_INCH, ELBOW],
    );

    expect(found).toEqual([]);
  });

  it("does not treat two items with no brand and no attributes as the same attributes", () => {
    const found = findLikelyDuplicates(
      { name: "Wall plug", brandId: null, categoryId: null, axisSignature: "" },
      [ELBOW],
    );

    expect(found).toEqual([]);
  });

  it("lists each candidate once, the stronger reason first", () => {
    const found = findLikelyDuplicates(
      {
        name: "PVC Pipe Supreme 0.5 in 4 kg",
        brandId: "supreme",
        categoryId: "pipes",
        axisSignature: "class=4 kg|size=0.5 in",
      },
      [PIPE_HALF_INCH],
    );

    expect(found).toEqual([
      expect.objectContaining({ variantId: "pipe-half", reason: "same_attributes" }),
    ]);
  });
});

describe("trigramSimilarity (spec 002 T041)", () => {
  it("is 1 for the same words in any order and 0 for nothing in common", () => {
    expect(trigramSimilarity("pvc pipe supreme", "supreme pvc pipe")).toBe(1);
    expect(trigramSimilarity("pipe", "valve")).toBe(0);
  });
});
