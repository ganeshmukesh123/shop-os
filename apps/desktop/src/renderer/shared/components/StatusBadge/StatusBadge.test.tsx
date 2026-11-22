import { screen } from "@testing-library/react";
import { ROLES_AND_COLOURS } from "../../../../../tests/helpers/statusRoles";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it.each(ROLES_AND_COLOURS)(
    "shows a word, never only a colour, for the %s role",
    (role, colourName) => {
      renderWithTheme(<StatusBadge role={role} label="Cancelled" />);

      const badge = screen.getByText("Cancelled");

      expect(badge.textContent).toBe("Cancelled");
      expect(badge.getAttribute("data-accent-color")).toBe(colourName);
    },
  );
});
