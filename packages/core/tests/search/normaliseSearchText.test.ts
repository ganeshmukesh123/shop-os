import { normaliseSearchText } from "../../src/search/normaliseSearchText";

describe("normaliseSearchText (task T007, research D4)", () => {
  it("makes the text lower case", () => {
    expect(normaliseSearchText("PVC Pipe")).toBe("pvc pipe");
  });

  it("removes Latin diacritics", () => {
    expect(normaliseSearchText("Café Müller Ñandú")).toBe("cafe muller nandu");
  });

  it("removes multiple combining accents from one Latin letter", () => {
    expect(normaliseSearchText("e\u0301\u0300")).toBe("e");
  });

  it("joins a letter and its separate accent the same way as the one-piece letter", () => {
    const onePiece = normaliseSearchText("café");
    const accentApart = normaliseSearchText("café");

    expect(onePiece).toBe("cafe");
    expect(accentApart).toBe("cafe");
  });

  it("keeps Devanagari as typed, including its vowel signs", () => {
    expect(normaliseSearchText("पाइप")).toBe("पाइप");
    expect(normaliseSearchText("कोहनी Elbow")).toBe("कोहनी elbow");
  });

  it("turns punctuation into single spaces and trims the ends", () => {
    expect(normaliseSearchText("  T-Joint/2'' ,PVC. ")).toBe("t joint 2 pvc");
  });

  it("keeps digits and the decimal parts of a size apart", () => {
    expect(normaliseSearchText("0.5 in")).toBe("0 5 in");
  });

  it("gives an empty text for an empty or punctuation-only text", () => {
    expect(normaliseSearchText("")).toBe("");
    expect(normaliseSearchText(" -/. ")).toBe("");
  });
});
