import { resolveCategoryDefaults } from "../../src/catalogue/categoryDefaults";

/** Spec 002 T027 (data-model.md "category"): a child inherits empty defaults from its ancestors. */
const PIPES = { defaultHsn: "3917", defaultBaseUom: "metre", titleTemplate: "{brand} {size}" };

describe("resolveCategoryDefaults (spec 002 T027)", () => {
  it("takes each empty default from the nearest ancestor that has one", () => {
    const path = [
      PIPES,
      { defaultHsn: "391723", defaultBaseUom: null, titleTemplate: null },
      { defaultHsn: null, defaultBaseUom: "pcs", titleTemplate: "" },
    ];

    expect(resolveCategoryDefaults(path)).toEqual({
      defaultHsn: "391723",
      defaultBaseUom: "pcs",
      titleTemplate: "{brand} {size}",
    });
  });

  it("keeps the category's own defaults when it has them", () => {
    expect(resolveCategoryDefaults([PIPES])).toEqual(PIPES);
  });

  it("gives no defaults for an uncategorised family", () => {
    expect(resolveCategoryDefaults([])).toEqual({
      defaultHsn: null,
      defaultBaseUom: null,
      titleTemplate: null,
    });
  });
});
