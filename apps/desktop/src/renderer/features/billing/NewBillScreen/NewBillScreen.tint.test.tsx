import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  BillsSaveInput,
  IFamilyDetail,
  IItemSearchRow,
  ITintResolved,
  IVariant,
} from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { NewBillScreen } from "./NewBillScreen";

/** Spec 002 T064: a base paint in the bill search opens the tinting desk; the can is billed tinted. */
const PASTEL = {
  id: "pastel-4l",
  familyId: "royale",
  displayName: "Royale Pastel 4 L",
  axes: { base_type: "Pastel", pack_size: "4 L" },
  baseUom: "pcs",
  allowDecimal: false,
  sellingPricePaise: 145_000,
  stockMilli: 10_000,
  isActive: true,
  mergedIntoId: null,
} as unknown as IVariant;
const ROYALE_ROW: IItemSearchRow = {
  kind: "family",
  familyKind: "base_paint",
  id: "royale",
  displayName: "Royale",
  matchedBy: "whole_word",
  stockMilli: 10_000,
  pricePaise: 145_000,
  item: null,
};
const RESOLVED = {
  baseVariant: PASTEL,
  formula: { id: "sky-v1", shadeId: "sky", baseVariantId: "pastel-4l", version: 1, lines: [] },
  lines: [{ colorantVariantId: "blue", name: "Blue", qtyMilli: 12_500, stockMilli: 980_000 }],
  unitPricePaise: 151_000,
  chargePaise: 6_000,
  costPaise: null,
} satisfies ITintResolved;

describe("bill screen: tinted paint (spec 002 T064)", () => {
  it("opens the tinting desk for a base paint and saves the can with its formula", async () => {
    const fake = installFakeShopos({
      "bills.draft.load": () => ({ payload: null }),
      "bills.draft.save": () => ({}),
      "items.search": () => ({ results: [ROYALE_ROW] }),
      "families.get": () => ({ variants: [PASTEL] }) as unknown as IFamilyDetail,
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
      "tint.resolve": () => RESOLVED,
      "bills.save": () => {
        throw Object.assign(new Error("stop here"), { code: "INTERNAL" });
      },
    });
    renderWithTheme(
      <ToastProvider>
        <NewBillScreen />
      </ToastProvider>,
    );

    await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "royale");
    await userEvent.click(await screen.findByRole("option", { name: /Royale/ }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Find a shade" }), "sky");
    await userEvent.click(await screen.findByRole("radio", { name: /Sky Blue/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Royale Pastel 4 L" }));
    await userEvent.click(await screen.findByRole("button", { name: "Add to bill" }));
    await userEvent.click(await screen.findByRole("button", { name: /Save bill/ }));

    expect(await screen.findByText("Sky Blue: Blue 12.5 ml")).toBeTruthy();
    const sent = fake.calls.find((call) => call.commandName === "bills.save")!
      .input as BillsSaveInput;
    expect(sent.lines).toEqual([
      {
        itemId: "pastel-4l",
        quantityMilli: 1_000,
        ratePaise: 151_000,
        lineDiscountPaise: 0,
        tint: { formulaId: "sky-v1" },
      },
    ]);
  });
});
