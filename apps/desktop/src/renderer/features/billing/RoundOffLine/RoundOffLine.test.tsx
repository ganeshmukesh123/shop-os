import { screen } from "@testing-library/react";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { RoundOffLine } from "./RoundOffLine";

describe("RoundOffLine (FR-010a)", () => {
  it("shows a round-down with its minus sign: ₹849.49 loses 49 paise", () => {
    renderWithTheme(<RoundOffLine roundOffPaise={-49} />);

    expect(screen.getByText("Round off: -₹0.49")).toBeTruthy();
  });

  it("shows nothing when the total needed no rounding", () => {
    const { container } = renderWithTheme(<RoundOffLine roundOffPaise={0} />);

    expect(container.textContent).toBe("");
  });
});
