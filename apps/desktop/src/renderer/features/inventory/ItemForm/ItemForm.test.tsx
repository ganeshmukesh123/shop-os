import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../../../shared/components/Toast";
import { ItemForm } from "./ItemForm";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";

function renderItemForm() {
  installFakeShopos({ "items.list": () => ({ items: [], total: 0 }) });
  return renderWithTheme(
    <ToastProvider>
      <ItemForm onClose={() => {}} onDone={() => {}} />
    </ToastProvider>,
  );
}

describe("item form layout", () => {
  it("shows the name, unit, price and opening quantity fields with their labels", () => {
    renderItemForm();

    expect(screen.getByRole("textbox", { name: /Item name/ })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Unit" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Selling price/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Opening quantity" })).toBeTruthy();
  });

  it("shows the custom unit field beside the unit only when Custom is chosen", async () => {
    renderItemForm();
    expect(screen.queryByRole("textbox", { name: "Custom unit name" })).toBeNull();

    await userEvent.click(screen.getByRole("combobox", { name: "Unit" }));
    await userEvent.click(await screen.findByRole("option", { name: "Custom…" }));

    expect(screen.getByRole("textbox", { name: "Custom unit name" })).toBeTruthy();
  });

  it("says Error with the reason when the form is saved empty", async () => {
    renderItemForm();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts[0]?.textContent).toBe("Error Enter the item name");
  });
});
