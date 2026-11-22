import { screen } from "@testing-library/react";
import { renderWithTheme } from "../../../../tests/helpers/renderWithTheme";
import { ClockWarnings } from "./ClockWarnings";

describe("ClockWarnings (task T080, FR-019a)", () => {
  it("shows nothing when there is no warning", () => {
    const { container } = renderWithTheme(<ClockWarnings warnings={[]} />);

    expect(container.querySelector("[role]")).toBeNull();
  });

  it("says, with a word, that the time zone differs", () => {
    renderWithTheme(<ClockWarnings warnings={["TIME_ZONE_DIFFERS"]} />);

    const message = screen.getByRole("alert");
    expect(message.textContent).toBe(
      "Time zone differs This computer is set to a different time zone than the shop. Bill dates follow the shop's zone; check both in Settings.",
    );
  });

  it("says, with a word, that the clock is earlier than the last bill", () => {
    renderWithTheme(<ClockWarnings warnings={["CLOCK_BEFORE_LAST_BILL"]} />);

    const message = screen.getByRole("alert");
    expect(message.textContent).toBe(
      "Check the clock This computer's clock is earlier than your last bill. Fix the date and time so bill dates stay right.",
    );
  });

  it("shows both warnings, one message each, in the order given", () => {
    renderWithTheme(<ClockWarnings warnings={["TIME_ZONE_DIFFERS", "CLOCK_BEFORE_LAST_BILL"]} />);

    const labels = screen.getAllByRole("alert").map((message) => message.textContent ?? "");
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("Time zone differs");
    expect(labels[1]).toContain("Check the clock");
  });
});
