import { screen } from "@testing-library/react";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { NEGATIVE_INACTIVE_ITEM } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { ItemsScreen } from "./ItemsScreen";

describe("ItemsScreen (design guidelines 5.1, PRD NFR-011)", () => {
  it("an item with negative stock and an inactive item each carry a word", async () => {
    installFakeShopos({
      "items.list": () => ({ items: [NEGATIVE_INACTIVE_ITEM], total: 1 }),
    });

    renderWithTheme(
      <ToastProvider>
        <ItemsScreen />
      </ToastProvider>,
    );

    expect(await screen.findByText("Negative stock: needs correction")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });
});
