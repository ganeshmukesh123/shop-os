import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../shared/text/strings";
import { NewFamilyButton } from "./NewFamilyButton";

/** Spec 002 US1: the Items screen opens the new-family form, with the shop's lists loaded. */
function renderButton() {
  const fake = installFakeShopos({
    "catalogue.units.list": () => ({
      units: [{ code: "pcs", label: "Pieces", dimension: "count", allowDecimal: false }],
    }),
    "catalogue.categories.list": () => ({ categories: [] }),
    "catalogue.brands.list": () => ({
      brands: [{ id: "brand-1", name: "Supreme" }],
    }),
  });
  const onSaved = vi.fn();
  renderWithTheme(<NewFamilyButton onSaved={onSaved} />);
  return { fake, onSaved };
}

describe("NewFamilyButton (spec 002 US1)", () => {
  it("opens the new-family form with the shop's units and brands", async () => {
    const { fake } = renderButton();

    await userEvent.click(screen.getByRole("button", { name: uiText.family.open }));
    const dialog = await screen.findByRole("dialog", { name: uiText.family.addTitle });
    await userEvent.click(await screen.findByRole("combobox", { name: uiText.family.brand }));

    expect(dialog).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Supreme" })).toBeTruthy();
    expect(fake.calls.map((sent) => sent.commandName)).toEqual(
      expect.arrayContaining(["catalogue.units.list", "catalogue.brands.list"]),
    );
  });

  it("loads nothing until it is opened", () => {
    const { fake } = renderButton();

    expect(fake.calls).toEqual([]);
  });
});
