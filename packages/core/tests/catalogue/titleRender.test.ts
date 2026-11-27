import { renderTitle } from "../../src/catalogue/titleRender";

/** Spec 002 T027: a variant's display name from its category's title template. */
describe("renderTitle (spec 002 T027)", () => {
  it('renders {brand} {size} {class} as "Supreme 0.5 in 4 kg"', () => {
    expect(
      renderTitle("{brand} {size} {class}", { brand: "Supreme", size: "0.5 in", class: "4 kg" }),
    ).toBe("Supreme 0.5 in 4 kg");
  });

  it("skips a missing or blank value without leaving a double space", () => {
    expect(renderTitle("{brand} {size} {class}", { size: "0.5 in", class: "4 kg" })).toBe(
      "0.5 in 4 kg",
    );
    expect(
      renderTitle("{brand} {size} {class}", { brand: "Supreme", size: "  ", class: "4 kg" }),
    ).toBe("Supreme 4 kg");
  });

  it("keeps the template's own words and treats an unknown placeholder as missing", () => {
    expect(renderTitle("PVC Pipe {size} {colour} - {class}", { size: "1 in", class: "6 kg" })).toBe(
      "PVC Pipe 1 in - 6 kg",
    );
  });

  it("skips an inherited constructor on a plain object", () => {
    expect(renderTitle("PVC {constructor} {size}", { size: "1 in" })).toBe("PVC 1 in");
  });

  it("skips inherited strings and renders an explicitly supplied constructor", () => {
    const values = { constructor: "  Custom  " };
    Object.setPrototypeOf(values, { brand: "Supreme" });

    expect(renderTitle("{brand} {constructor}", values)).toBe("Custom");
  });

  it("gives an empty title when nothing is filled in, so the caller falls back to the family name", () => {
    expect(renderTitle("{brand} {size}", {})).toBe("");
  });
});
