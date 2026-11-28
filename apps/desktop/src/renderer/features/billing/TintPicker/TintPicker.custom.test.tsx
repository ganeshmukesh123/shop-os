import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  IFamilyDetail,
  IItemSearchRow,
  ITintResolved,
  IVariant,
  TintCustomShadeSaveInput,
  TintResolveInput,
} from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { TintPicker } from "./TintPicker";

/** Spec 002 T064 (FR-016, quickstart 3 step 3): a custom shade when the pack has no formula. */
const WHITE = {
  id: "white-1l",
  familyId: "royale",
  displayName: "Royale White 1 L",
  axes: { base_type: "White", pack_size: "1 L" },
  baseUom: "pcs",
  allowDecimal: false,
  sellingPricePaise: 40_000,
  stockMilli: 10_000,
  isActive: true,
  mergedIntoId: null,
} as unknown as IVariant;
const BLUE_ROW: IItemSearchRow = {
  kind: "variant",
  id: "blue",
  displayName: "Blue",
  matchedBy: "whole_word",
  stockMilli: 1_000_000,
  pricePaise: 300,
  item: buildItem({ id: "blue", name: "Blue", unit: "ml", allowsDecimal: true }),
};
const SHARMA_SHADE = {
  id: "sharma-white",
  shadeCode: "C-0002",
  shadeName: "Sharma off-white",
  brandId: null,
  shadeCard: null,
  source: "custom" as const,
  customerLabel: "Sharma",
  siteLabel: null,
};

function renderPicker() {
  let hasCustomShade = false;
  const fake = installFakeShopos({
    "families.get": () => ({ variants: [WHITE] }) as unknown as IFamilyDetail,
    "tint.shades.search": () => ({
      shades: [{ ...SHARMA_SHADE, id: "sky", shadeName: "Sky Blue" }],
    }),
    "items.search": () => ({ results: [BLUE_ROW] }),
    "tint.customShade.save": () => {
      hasCustomShade = true;
      return {
        shade: SHARMA_SHADE,
        formula: {
          id: "sharma-v1",
          shadeId: "sharma-white",
          baseVariantId: "white-1l",
          version: 1,
          lines: [],
        },
      };
    },
    "tint.resolve": (input: TintResolveInput) => {
      if (!hasCustomShade || input.shadeId !== "sharma-white") {
        throw Object.assign(new Error("No formula"), { code: "NO_FORMULA" });
      }
      return {
        baseVariant: WHITE,
        formula: {
          id: "sharma-v1",
          shadeId: "sharma-white",
          baseVariantId: "white-1l",
          version: 1,
          lines: [],
        },
        lines: [
          { colorantVariantId: "blue", name: "Blue", qtyMilli: 5_000, stockMilli: 1_000_000 },
        ],
        unitPricePaise: 42_000,
        chargePaise: 2_000,
        costPaise: null,
      } satisfies ITintResolved;
    },
  });
  renderWithTheme(
    <TintPicker
      familyId="royale"
      title="Royale"
      customerName="Sharma"
      onAdd={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return fake;
}

describe("TintPicker custom shade (spec 002 T064)", () => {
  it("saves a custom shade for Sharma with 5 ml Blue on the chosen can, then shows its mix", async () => {
    const fake = renderPicker();
    const text = uiText.bill.tintPicker;
    await userEvent.type(await screen.findByRole("textbox", { name: text.findShade }), "sky");
    await userEvent.click(await screen.findByRole("radio", { name: /Sky Blue/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Royale White 1 L" }));
    await userEvent.click(await screen.findByRole("button", { name: text.customShade }));

    await userEvent.type(
      screen.getByRole("textbox", { name: text.custom.name }),
      "Sharma off-white",
    );
    await userEvent.type(screen.getByRole("textbox", { name: text.custom.findColorant }), "blue");
    await userEvent.click(
      await screen.findByRole("button", { name: `${text.custom.addColorant}: Blue` }),
    );
    await userEvent.type(screen.getByRole("textbox", { name: "ml of Blue" }), "5");
    await userEvent.click(screen.getByRole("button", { name: text.custom.save }));

    const sent = fake.calls.find((call) => call.commandName === "tint.customShade.save")!
      .input as TintCustomShadeSaveInput;
    expect(sent).toEqual({
      shadeName: "Sharma off-white",
      customerLabel: "Sharma",
      baseVariantId: "white-1l",
      lines: [{ colorantVariantId: "blue", qtyMilli: 5_000 }],
    });
    expect(await screen.findByText("Blue 5 ml")).toBeTruthy();
    expect(screen.getByRole("button", { name: text.add })).toBeTruthy();
  });

  it("offers a custom shade when no shade is chosen yet, so the first shade can be made here", async () => {
    renderPicker();

    await userEvent.click(await screen.findByRole("radio", { name: "Royale White 1 L" }));
    await userEvent.click(
      await screen.findByRole("button", { name: uiText.bill.tintPicker.customShade }),
    );

    expect(screen.getByRole("textbox", { name: uiText.bill.tintPicker.custom.name })).toBeTruthy();
  });

  it("does not save a shade without a name or a colorant amount", async () => {
    const fake = renderPicker();
    const text = uiText.bill.tintPicker;
    await userEvent.type(await screen.findByRole("textbox", { name: text.findShade }), "sky");
    await userEvent.click(await screen.findByRole("radio", { name: /Sky Blue/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Royale White 1 L" }));
    await userEvent.click(await screen.findByRole("button", { name: text.customShade }));

    await userEvent.click(screen.getByRole("button", { name: text.custom.save }));

    expect(await screen.findByText(text.custom.incomplete)).toBeTruthy();
    expect(fake.calls.some((call) => call.commandName === "tint.customShade.save")).toBe(false);
  });
});
