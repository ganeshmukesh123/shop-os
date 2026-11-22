import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ROLES_AND_COLOURS } from "../../../../../tests/helpers/statusRoles";
import { StatusMessage } from "./StatusMessage";

describe("StatusMessage (design guidelines 5.1)", () => {
  it("puts the label first and the plain sentence after it", () => {
    renderWithTheme(
      <StatusMessage role="danger" label="Blocked">
        Above MRP. Lower the rate to continue.
      </StatusMessage>,
    );

    const message = screen.getByRole("alert");

    expect(message.textContent).toBe("Blocked Above MRP. Lower the rate to continue.");
  });

  it.each(ROLES_AND_COLOURS)("shows its word and the %s colour role", (role, colourName) => {
    renderWithTheme(
      <StatusMessage role={role} label="Pending">
        UPI payment not confirmed yet.
      </StatusMessage>,
    );

    const message = screen.getByText("Pending").closest("[data-accent-color], .rt-CalloutRoot");

    expect(screen.getByText("Pending")).toBeTruthy();
    expect(message?.getAttribute("data-accent-color")).toBe(colourName);
  });

  it("announces problems at once, and results politely", () => {
    renderWithTheme(
      <>
        <StatusMessage role="danger" label="Blocked">
          one
        </StatusMessage>
        <StatusMessage role="warning" label="Negative stock">
          two
        </StatusMessage>
        <StatusMessage role="success" label="Saved">
          three
        </StatusMessage>
        <StatusMessage role="neutral" label="Draft">
          four
        </StatusMessage>
      </>,
    );

    expect(screen.getAllByRole("alert").map((alertElement) => alertElement.textContent)).toEqual([
      "Blocked one",
      "Negative stock two",
    ]);
    expect(screen.getAllByRole("status").map((statusElement) => statusElement.textContent)).toEqual(
      ["Saved three", "Draft four"],
    );
  });

  it("offers one action and runs it when pressed", async () => {
    let pressCount = 0;
    renderWithTheme(
      <StatusMessage
        role="success"
        label="Saved"
        action={{ label: "Print", onClick: () => (pressCount += 1) }}
      >
        Bill C1/26-27/000123 saved.
      </StatusMessage>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Print" }));

    expect(pressCount).toBe(1);
  });

  it("shows no button when there is no action", () => {
    renderWithTheme(
      <StatusMessage role="neutral" label="Draft">
        Two lines.
      </StatusMessage>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
