import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BillsSaveInput, ITintRepeat, ITintResolved, IVariant } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { NewBillScreen } from "./NewBillScreen";

/** Spec 002 T065 (FR-016, quickstart 3 step 4): a customer's shades; one tap adds the same mix. */
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
const SHADE = {
  id: "sky",
  shadeCode: "C-0001",
  shadeName: "Sky Blue",
  brandId: null,
  shadeCard: null,
  source: "custom" as const,
  customerLabel: "Sharma",
  siteLabel: null,
};
const BILLED_SKY: ITintRepeat = {
  shade: SHADE,
  formula: { id: "sky-v1", shadeId: "sky", baseVariantId: "pastel-4l", version: 1, lines: [] },
  lastBilledAt: new Date("2026-11-20T10:00:00+05:30").getTime(),
  baseVariant: PASTEL,
  sourceBillLineId: "line-earlier",
  lines: [
    { colorantVariantId: "blue", qtyMilli: 12_500, name: "Blue" },
    { colorantVariantId: "black", qtyMilli: 750, name: "Black" },
  ],
};

function renderBill() {
  return installFakeShopos({
    "bills.draft.load": () => ({ payload: null }),
    "bills.draft.save": () => ({}),
    "tint.repeat.list": () => ({ shades: [BILLED_SKY] }),
    "tint.resolve": () =>
      ({
        baseVariant: PASTEL,
        formula: BILLED_SKY.formula,
        lines: [
          { colorantVariantId: "blue", name: "Blue", qtyMilli: 13_000, stockMilli: 1 },
          { colorantVariantId: "black", name: "Black", qtyMilli: 500, stockMilli: 1 },
        ],
        unitPricePaise: 151_000,
        chargePaise: 6_000,
        costPaise: null,
      }) satisfies ITintResolved,
    "bills.save": () => {
      throw Object.assign(new Error("stop here"), { code: "INTERNAL" });
    },
  });
}

describe("bill screen: repeat shades (spec 002 T065)", () => {
  it("lists Sharma's shades once the name is typed and adds the saved mix with one tap", async () => {
    const fake = renderBill();
    renderWithTheme(
      <ToastProvider>
        <NewBillScreen />
      </ToastProvider>,
    );

    await userEvent.type(
      await screen.findByRole("textbox", { name: uiText.bill.customerName }),
      "sharma",
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Sky Blue, Royale Pastel 4 L/ }),
    );
    await userEvent.click(await screen.findByRole("button", { name: /Save bill/ }));

    expect(await screen.findByText("Sky Blue: Blue 12.5 ml, Black 0.75 ml")).toBeTruthy();
    const sent = fake.calls.find((call) => call.commandName === "bills.save")!
      .input as BillsSaveInput;
    expect(sent.lines).toEqual([
      {
        itemId: "pastel-4l",
        quantityMilli: 1_000,
        ratePaise: 151_000,
        lineDiscountPaise: 0,
        tint: { sourceBillLineId: "line-earlier" },
      },
    ]);
  });
});
