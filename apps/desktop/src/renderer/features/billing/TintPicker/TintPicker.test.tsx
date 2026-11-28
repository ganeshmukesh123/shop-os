import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IFamilyDetail, ITintResolved, IVariant, TintResolveInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { TintPicker } from "./TintPicker";

/** Spec 002 T064 (FR-014, FR-015, quickstart 3 steps 1 and 3): the tinting desk on the bill. */
const variant = (id: string, displayName: string, axes: Record<string, string>) =>
  ({
    id,
    familyId: "royale",
    displayName,
    axes,
    baseUom: "pcs",
    allowDecimal: false,
    sellingPricePaise: 145_000,
    stockMilli: 10_000,
    isActive: true,
    mergedIntoId: null,
  }) as unknown as IVariant;
const PASTEL = variant("pastel-4l", "Royale Pastel 4 L", { base_type: "Pastel", pack_size: "4 L" });
const WHITE = variant("white-1l", "Royale White 1 L", { base_type: "White", pack_size: "1 L" });
const RESOLVED = {
  baseVariant: PASTEL,
  formula: { id: "sky-v1", shadeId: "sky", baseVariantId: "pastel-4l", version: 1, lines: [] },
  lines: [
    { colorantVariantId: "blue", name: "Blue", qtyMilli: 12_500, stockMilli: 980_000 },
    { colorantVariantId: "black", name: "Black", qtyMilli: 750, stockMilli: 990_000 },
  ],
  unitPricePaise: 151_000,
  chargePaise: 6_000,
  costPaise: 113_225,
} satisfies ITintResolved;

function renderPicker() {
  installFakeShopos({
    "families.get": () => ({ variants: [PASTEL, WHITE] }) as unknown as IFamilyDetail,
    "tint.shades.search": () => ({
      shades: [
        {
          id: "sky",
          shadeCode: "C-0001",
          shadeName: "Sky Blue",
          brandId: null,
          shadeCard: null,
          source: "custom",
          customerLabel: "Sharma",
          siteLabel: null,
        },
      ],
    }),
    "tint.resolve": (input: TintResolveInput) => {
      if (input.packVariantId === "white-1l") {
        throw Object.assign(new Error("No formula"), { code: "NO_FORMULA" });
      }
      return RESOLVED;
    },
  });
  const onAdd = vi.fn();
  renderWithTheme(<TintPicker familyId="royale" title="Royale" onAdd={onAdd} onClose={vi.fn()} />);
  return onAdd;
}

async function choose(pack: string) {
  const text = uiText.bill.tintPicker;
  await userEvent.type(await screen.findByRole("textbox", { name: text.findShade }), "sky");
  await userEvent.click(await screen.findByRole("radio", { name: /Sky Blue/ }));
  await userEvent.click(screen.getByRole("radio", { name: pack }));
}

describe("TintPicker (spec 002 T064)", () => {
  it("shows the colorant amounts with stock and the price, then adds the can", async () => {
    const onAdd = renderPicker();

    await choose("Royale Pastel 4 L");

    expect(await screen.findByText("Blue 12.5 ml")).toBeTruthy();
    expect(screen.getByText("Black 0.75 ml")).toBeTruthy();
    expect(screen.getByText("₹1,450.00 + tint ₹60.00 = ₹1,510.00")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: uiText.bill.tintPicker.add }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pastel-4l", name: "Royale Pastel 4 L" }),
      {
        tint: { formulaId: "sky-v1" },
        ratePaise: 151_000,
        label: "Sky Blue: Blue 12.5 ml, Black 0.75 ml",
      },
    );
  });

  it("says when a pack has no formula and offers a custom shade", async () => {
    renderPicker();

    await choose("Royale White 1 L");

    expect(await screen.findByText(uiText.bill.tintPicker.noFormula)).toBeTruthy();
    expect(screen.getByRole("button", { name: uiText.bill.tintPicker.customShade })).toBeTruthy();
    expect(screen.queryByRole("button", { name: uiText.bill.tintPicker.add })).toBeNull();
  });
});
