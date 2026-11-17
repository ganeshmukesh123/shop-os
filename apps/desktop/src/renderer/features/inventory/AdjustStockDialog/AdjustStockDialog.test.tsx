import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { NEGATIVE_INACTIVE_ITEM } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { AdjustStockDialog } from "./AdjustStockDialog";

describe("AdjustStockDialog (design guidelines 5.1, PRD NFR-011)", () => {
  it("an adjustment without a note says Error and what is missing", async () => {
    installFakeShopos();
    renderWithTheme(
      <ToastProvider>
        <AdjustStockDialog item={NEGATIVE_INACTIVE_ITEM} onClose={() => {}} onDone={() => {}} />
      </ToastProvider>,
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Quantity (pcs)" }), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error A note is required");
  });
});
