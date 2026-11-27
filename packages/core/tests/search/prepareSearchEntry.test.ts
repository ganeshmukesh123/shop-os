import {
  prepareSearchEntry,
  rankPreparedMatches,
  rankSearchMatches,
  type ISearchEntry,
} from "../../src/search/rankSearchMatches";

/**
 * Spec 002 T024 (finding 5 of the core PRs): the index keeps names already normalised and split,
 * so a search does not normalise 50,000 names again on every key press.
 */
const ELBOW: ISearchEntry = {
  variantId: "elbow-1in",
  familyId: "elbow",
  familyVariantCount: 1,
  names: ["  Elbow-1 Inch ", "Café Joint"],
  codes: ["ITM-0007", "8901234567890"],
};

const PIPE_FAMILY: ISearchEntry[] = [
  {
    variantId: "pipe-half",
    familyId: "pipe",
    familyVariantCount: 2,
    names: ["PVC Pipe 0.5 in", "nali"],
    codes: ["ITM-0001"],
  },
  {
    variantId: "pipe-one",
    familyId: "pipe",
    familyVariantCount: 2,
    names: ["PVC Pipe 1 in"],
    codes: ["ITM-0002"],
  },
];

describe("prepareSearchEntry (spec 002 T024)", () => {
  it("normalises each name into its words and each code whole, once", () => {
    expect(prepareSearchEntry(ELBOW)).toEqual({
      variantId: "elbow-1in",
      familyId: "elbow",
      familyVariantCount: 1,
      nameWords: [
        ["elbow", "1", "inch"],
        ["cafe", "joint"],
      ],
      codes: ["itm 0007", "8901234567890"],
    });
  });
});

describe("rankPreparedMatches (spec 002 T024)", () => {
  const entries = [ELBOW, ...PIPE_FAMILY];
  const sales = new Map([["pipe-one", 3]]);

  it.each(["elbo", "nali", "pipe", "ITM-0002", "8901234567890", "cafe", "paip", "xyz", ""])(
    "ranks %j exactly as rankSearchMatches does",
    (query) => {
      expect(rankPreparedMatches(query, entries.map(prepareSearchEntry), sales)).toEqual(
        rankSearchMatches(query, entries, sales),
      );
    },
  );
});
