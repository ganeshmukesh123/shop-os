import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { buildItem } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { ItemsScreen } from "./ItemsScreen";

/** Spec 002 US1 wired into the Items screen: New family, and Units on each row. */
const WIRE = buildItem({ id: "wire", name: "Copper Wire", unit: "metre", familyId: "family-wire" });

function renderScreen() {
  installFakeShopos({
    "items.list": () => ({ items: [WIRE], total: 1 }),
    "catalogue.units.list": () => ({ units: [] }),
    "catalogue.categories.list": () => ({ categories: [] }),
    "catalogue.brands.list": () => ({ brands: [] }),
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
  });
  renderWithTheme(
    <ToastProvider>
      <ItemsScreen />
    </ToastProvider>,
  );
}

describe("ItemsScreen with families (spec 002 US1)", () => {
  it("opens the new-family form from the header", async () => {
    renderScreen();

    await userEvent.click(await screen.findByRole("button", { name: uiText.family.open }));

    expect(await screen.findByRole("dialog", { name: uiText.family.addTitle })).toBeTruthy();
  });

  it("opens an item's other units from its row", async () => {
    renderScreen();
    const row = (await screen.findByRole("rowheader", { name: "Copper Wire" })).closest("tr")!;

    await userEvent.click(within(row).getByRole("button", { name: uiText.family.units.open }));

    expect(
      await screen.findByRole("dialog", { name: `${uiText.family.units.title}: Copper Wire` }),
    ).toBeTruthy();
  });
});
