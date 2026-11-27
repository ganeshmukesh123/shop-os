import { rankSearchMatches, type ISearchEntry } from "../../src/search/rankSearchMatches";

function entry(
  variantId: string,
  names: string[],
  options: { familyId?: string; familyVariantCount?: number; codes?: string[] } = {},
): ISearchEntry {
  return {
    variantId,
    familyId: options.familyId ?? `family-${variantId}`,
    familyVariantCount: options.familyVariantCount ?? 1,
    names,
    codes: options.codes ?? [],
  };
}

const noSales = new Map<string, number>();

const idsOf = (results: { id: string }[]) => results.map((result) => result.id);

describe("rankSearchMatches (task T008, research D4)", () => {
  it("ranks by tier: exact code, whole word, prefix, then fuzzy", () => {
    const entries = [
      entry("fuzzy", ["Elbwo clamp"]),
      entry("prefix", ["Elbowed pipe"]),
      entry("word", ["Elbow 1 in"]),
      entry("code", ["Pipe coupler"], { codes: ["ELBOW"] }),
    ];

    const results = rankSearchMatches("elbow", entries, noSales);

    expect(results.map((result) => [result.id, result.tier])).toEqual([
      ["code", "code"],
      ["word", "whole_word"],
      ["prefix", "prefix"],
      ["fuzzy", "fuzzy"],
    ]);
  });

  it("puts an exact barcode first, matching it as typed", () => {
    const entries = [
      entry("name", ["8901234567890 pipe"]),
      entry("scanned", ["Pipe 1 in"], { codes: ["8901234567890"] }),
    ];

    expect(idsOf(rankSearchMatches(" 8901234567890 ", entries, noSales))[0]).toBe("scanned");
  });

  it("puts the item with more bills in the last 90 days first within a tier", () => {
    const entries = [entry("slow", ["Elbow 1 in"]), entry("busy", ["Elbow 2 in"])];
    const sales = new Map([
      ["slow", 3],
      ["busy", 40],
    ]);

    expect(idsOf(rankSearchMatches("elbow", entries, sales))).toEqual(["busy", "slow"]);
  });

  it("keeps a better tier above a busier item in a worse tier", () => {
    const entries = [entry("busy-prefix", ["Elbowed pipe"]), entry("quiet-word", ["Elbow 1 in"])];
    const sales = new Map([["busy-prefix", 500]]);

    expect(idsOf(rankSearchMatches("elbow", entries, sales))).toEqual([
      "quiet-word",
      "busy-prefix",
    ]);
  });

  it("keeps the list order when the tier and the bill count are the same", () => {
    const entries = [entry("first", ["Elbow 1 in"]), entry("second", ["Elbow 2 in"])];

    expect(idsOf(rankSearchMatches("elbow", entries, noSales))).toEqual(["first", "second"]);
  });

  it("allows one typo in a word of 4 to 7 letters, and none in a word of 3", () => {
    const entries = [entry("pipe", ["Pope 1 in"]), entry("pip", ["Pop clip"])];

    expect(idsOf(rankSearchMatches("pipe", entries, noSales))).toEqual(["pipe"]);
    expect(idsOf(rankSearchMatches("pip", entries, noSales))).toEqual([]);
  });

  it("allows two typos in a word of 8 or more letters, but not in a shorter one", () => {
    const entries = [entry("hardware", ["Hardware store"])];

    expect(idsOf(rankSearchMatches("hardwxrx", entries, noSales))).toEqual(["hardware"]);
    expect(idsOf(rankSearchMatches("paipa", [entry("pipe", ["Pipe"])], noSales))).toEqual([]);
  });

  it("matches every word of the query, in any order", () => {
    const entries = [entry("match", ["Elbow PVC 1 in"]), entry("partial", ["Elbow GI 1 in"])];

    expect(idsOf(rankSearchMatches("pvc elbow", entries, noSales))).toEqual(["match"]);
  });

  it("gives a prefix tier when one word of the query is only a prefix", () => {
    const [result] = rankSearchMatches("pvc elb", [entry("one", ["Elbow PVC 1 in"])], noSales);

    expect(result!.tier).toBe("prefix");
  });

  it("ignores case, accents and punctuation, and finds Devanagari", () => {
    const entries = [entry("cafe", ["Café-Chair"]), entry("hindi", ["पाइप 1 इंच"])];

    expect(idsOf(rankSearchMatches("CAFE chair", entries, noSales))).toEqual(["cafe"]);
    expect(idsOf(rankSearchMatches("पाइप", entries, noSales))).toEqual(["hindi"]);
  });

  it("matches on any of an item's names", () => {
    const entries = [entry("tee", ["Tee 1 in", "T-joint"])];

    expect(idsOf(rankSearchMatches("joint", entries, noSales))).toEqual(["tee"]);
  });

  it("gives nothing for an empty query or for an item that does not match", () => {
    const entries = [entry("tee", ["Tee 1 in"])];

    expect(rankSearchMatches("   ", entries, noSales)).toEqual([]);
    expect(rankSearchMatches("valve", entries, noSales)).toEqual([]);
  });
});

describe("rankSearchMatches: families", () => {
  const sizes = ["0.5 in", "1 in", "2 in"].map((size, index) =>
    entry(`pipe-${index}`, [`PVC pipe ${size}`], {
      familyId: "pipe-family",
      familyVariantCount: 3,
    }),
  );

  it("shows a family with many variants once, as a family row", () => {
    const results = rankSearchMatches("pipe", sizes, noSales);

    expect(results).toEqual([
      { kind: "family", id: "pipe-family", tier: "whole_word", billCount90d: 0 },
    ]);
  });

  it("adds the bill counts of the family's matching variants and takes the best tier", () => {
    const entries = [
      ...sizes,
      entry("pipe-fuzzy", ["Pipo 3 in"], { familyId: "pipe-family", familyVariantCount: 4 }),
    ];
    const sales = new Map([
      ["pipe-0", 5],
      ["pipe-1", 7],
      ["pipe-fuzzy", 1],
    ]);

    const [family] = rankSearchMatches("pipe", entries, sales);

    expect(family).toEqual({
      kind: "family",
      id: "pipe-family",
      tier: "whole_word",
      billCount90d: 13,
    });
  });

  it("shows a one-variant family as a variant row", () => {
    const [result] = rankSearchMatches("tee", [entry("tee", ["Tee 1 in"])], noSales);

    expect(result!.kind).toBe("variant");
    expect(result!.id).toBe("tee");
  });

  it("keeps the variant row when a scan names one variant of a family exactly", () => {
    const entries = [
      ...sizes,
      entry("pipe-scanned", ["PVC pipe 4 in"], {
        familyId: "pipe-family",
        familyVariantCount: 4,
        codes: ["8901234500011"],
      }),
    ];

    const results = rankSearchMatches("8901234500011", entries, noSales);

    expect(results).toEqual([
      { kind: "variant", id: "pipe-scanned", tier: "code", billCount90d: 0 },
    ]);
  });

  it("never shows the same family twice, even next to other items", () => {
    const entries = [...sizes, entry("other", ["Pipe clip"])];

    const results = rankSearchMatches("pipe", entries, noSales);

    expect(results.filter((result) => result.id === "pipe-family")).toHaveLength(1);
    expect(results).toHaveLength(2);
  });
});
