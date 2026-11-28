import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BillsSaveInput } from "@shopos/core";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem, searchRowOf } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { NewBillScreen } from "./NewBillScreen";

/** Spec 002 T039: a bill line in another unit, shown "2 roll (180 metre)" and saved in both. */
const WIRE = buildItem({
  id: "wire",
  name: "Copper Wire",
  unit: "metre",
  allowsDecimal: true,
  pricePaise: 2_500,
  familyId: "family-wire",
});

function renderWireBill() {
  const fake = installFakeShopos({
    "bills.draft.load": () => ({ payload: null }),
    "bills.draft.save": () => ({}),
    "items.search": () => ({ results: [searchRowOf(WIRE)] }),
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
      conversions: [{ variantId: "wire", uomCode: "roll", factorMilli: 90_000 }],
      barcodes: [],
      searchNames: [],
    }),
  });
  renderWithTheme(
    <ToastProvider>
      <NewBillScreen />
    </ToastProvider>,
  );
  return fake;
}

async function addWireInRolls() {
  await userEvent.type(screen.getByRole("textbox", { name: /Type 2 or more letters/ }), "wire");
  await userEvent.click(await screen.findByRole("option", { name: /Copper Wire/ }));
  await userEvent.click(await screen.findByRole("combobox", { name: "Unit for Copper Wire" }));
  await userEvent.click(await screen.findByRole("option", { name: "roll" }));
  const quantity = screen.getByRole("textbox", { name: /Qty Copper Wire/ });
  await userEvent.clear(quantity);
  await userEvent.type(quantity, "2");
}

describe("bill screen: other units (spec 002 T039)", () => {
  it("bills 2 rolls as 180 metre, at the rate per metre, and says so", async () => {
    renderWireBill();

    await addWireInRolls();

    expect(await screen.findByText("(180 metre)")).toBeTruthy();
    expect(screen.getAllByText("₹4,500.00").length).toBeGreaterThan(0);
  });

  it("saves the line with the roll and the quantity typed", async () => {
    const fake = renderWireBill();
    await addWireInRolls();

    await userEvent.keyboard("{Control>}s{/Control}");

    const saved = fake.calls.find((sent) => sent.commandName === "bills.save");
    expect((saved?.input as BillsSaveInput | undefined)?.lines).toEqual([
      {
        itemId: "wire",
        quantityMilli: 2_000,
        ratePaise: 2_500,
        lineDiscountPaise: 0,
        enteredUom: "roll",
      },
    ]);
  });
});
