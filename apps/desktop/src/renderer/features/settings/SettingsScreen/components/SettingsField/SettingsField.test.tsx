import { screen } from "@testing-library/react";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { SettingsField } from "./SettingsField";

describe("SettingsField", () => {
  it("names its input by the label and shows the help text under it", () => {
    renderWithTheme(
      <SettingsField label="Shop name" help="Printed at the top of every bill">
        <input />
      </SettingsField>,
    );

    expect(screen.getByLabelText(/Shop name/)).toBeTruthy();
    expect(screen.getByText("Printed at the top of every bill")).toBeTruthy();
  });

  it("shows no help text when none is given", () => {
    renderWithTheme(
      <SettingsField label="Phone">
        <input />
      </SettingsField>,
    );

    expect(screen.queryByText("Printed at the top of every bill")).toBeNull();
  });
});
