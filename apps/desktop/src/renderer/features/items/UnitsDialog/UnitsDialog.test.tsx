import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { UnitsDialog } from "./UnitsDialog";

/** Spec 002 T037 wired in: an item's other units, opened from its row on the Items screen. */
const WIRE = buildItem({ id: "wire", name: "Copper Wire", unit: "metre", familyId: "family-wire" });

function renderDialog() {
  const fake = installFakeShopos({
    "families.get": () => ({
      family: {
        id: "family-wire",
        name: "Copper Wire",
        kind: "general",
        categoryId: null,
        brandId: null,
        spec: {},
        axisKeys: [],
      },
      variants: [],
      barcodes: [],
      searchNames: [],
      conversions: [
        { variantId: "wire", uomCode: "roll", factorMilli: 90_000 },
        { variantId: "other-variant", uomCode: "box", factorMilli: 1_000 },
      ],
    }),
    "catalogue.categories.list": () => ({ categories: [] }),
    "catalogue.brands.list": () => ({ brands: [] }),
    "catalogue.units.list": () => ({
      units: [
        { code: "metre", label: "Metre", dimension: "length", allowDecimal: true },
        { code: "roll", label: "Roll", dimension: "count", allowDecimal: false },
      ],
    }),
  });
  renderWithTheme(<UnitsDialog item={WIRE} onClose={vi.fn()} />);
  return fake;
}

describe("UnitsDialog (spec 002 T037)", () => {
  it("shows this item's other units only, with the example", async () => {
    const fake = renderDialog();

    expect(await screen.findByText("1 roll = 90 metre")).toBeTruthy();
    expect(screen.queryByText(/1 box/)).toBeNull();
    expect(fake.calls[0]).toEqual({ commandName: "families.get", input: { id: "family-wire" } });
  });

  it("is titled with the item's name", async () => {
    renderDialog();

    expect(
      await screen.findByRole("dialog", { name: `${uiText.family.units.title}: Copper Wire` }),
    ).toBeTruthy();
  });

  it("closes from its Close button", async () => {
    installFakeShopos({
      "families.get": () => ({
        family: {
          id: "family-wire",
          name: "Copper Wire",
          kind: "general",
          categoryId: null,
          brandId: null,
          spec: {},
          axisKeys: [],
        },
        variants: [],
        conversions: [],
        barcodes: [],
        searchNames: [],
      }),
      "catalogue.categories.list": () => ({ categories: [] }),
      "catalogue.brands.list": () => ({ brands: [] }),
      "catalogue.units.list": () => ({ units: [] }),
    });
    const onClose = vi.fn();
    renderWithTheme(<UnitsDialog item={WIRE} onClose={onClose} />);

    await userEvent.click(await screen.findByRole("button", { name: uiText.common.close }));

    expect(onClose).toHaveBeenCalled();
  });
});
