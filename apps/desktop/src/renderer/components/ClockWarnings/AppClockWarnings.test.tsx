import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos } from "../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../tests/helpers/renderWithTheme";
import { App } from "../../App";
import { ToastProvider } from "../Toast";

function renderApp(warnings: ("TIME_ZONE_DIFFERS" | "CLOCK_BEFORE_LAST_BILL")[]) {
  installFakeShopos({
    "settings.clockCheck": () => ({ warnings }),
    "items.list": () => ({ items: [], total: 0 }),
    "bills.draft.load": () => ({ payload: null }),
  });
  renderWithTheme(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

describe("the clock warning in the app shell (task T080, FR-019a)", () => {
  it("shows a warning with its word above the screen, and billing stays open", async () => {
    renderApp(["CLOCK_BEFORE_LAST_BILL"]);

    const warning = await screen.findByText("Check the clock");

    expect(warning.closest("[role=alert]")?.textContent).toContain("earlier than your last bill");
    expect(screen.getByRole("button", { name: "New bill" })).toBeTruthy();
  });

  it("shows nothing when the clock and the time zone are fine", async () => {
    renderApp([]);

    await screen.findByRole("button", { name: "Settings" });

    expect(screen.queryByText("Check the clock")).toBeNull();
    expect(screen.queryByText("Time zone differs")).toBeNull();
  });

  it("is still there on another screen, so it is not missed", async () => {
    renderApp(["TIME_ZONE_DIFFERS"]);
    await screen.findByText("Time zone differs");

    await userEvent.click(screen.getByRole("button", { name: "Items" }));

    expect(await screen.findByText("Time zone differs")).toBeTruthy();
  });
});
