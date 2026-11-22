import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeShopos, type FakeCommandHandlers } from "../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../shared/components/Toast";
import { App } from "./App";

function renderApp(handlers: FakeCommandHandlers = {}) {
  installFakeShopos({
    "settings.clockCheck": () => ({ warnings: [] }),
    "items.list": () => ({ items: [], total: 0 }),
    "bills.draft.load": () => ({ payload: null }),
    ...handlers,
  });
  renderWithTheme(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

const currentPage = () => screen.getByRole("button", { current: "page" }).textContent;

describe("App navigation (keyboard first: Ctrl+1 to Ctrl+3)", () => {
  it("opens on New bill", async () => {
    renderApp();

    expect(await screen.findByRole("heading", { name: "New bill" })).toBeTruthy();
    expect(currentPage()).toBe("New bill");
  });

  it("switches screens with Ctrl+1, Cmd+3 and Ctrl+2", async () => {
    renderApp();

    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(await screen.findByRole("heading", { name: "Items" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "3", metaKey: true });
    await waitFor(() => expect(currentPage()).toBe("Settings"));
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });

    expect(await screen.findByRole("heading", { name: "New bill" })).toBeTruthy();
  });

  it("ignores a number without Ctrl, and Ctrl with a key that is not a screen", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "New bill" });

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "9", ctrlKey: true });

    expect(currentPage()).toBe("New bill");
  });

  it("switches screens from the side menu", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("button", { name: "Items" }));

    expect(await screen.findByRole("heading", { name: "Items" })).toBeTruthy();
    expect(currentPage()).toBe("Items");
  });
});

describe("App correction count (US-1: negative stock needs a correction)", () => {
  it("shows how many items need a stock correction beside Items", async () => {
    renderApp({ "items.list": () => ({ items: [], total: 3 }) });

    expect(await screen.findByText("3 Needs correction")).toBeTruthy();
  });

  it("still opens when the count cannot be read", async () => {
    renderApp({
      "items.list": () => {
        throw new Error("database is busy");
      },
    });

    expect(await screen.findByRole("heading", { name: "New bill" })).toBeTruthy();
    expect(screen.queryByText(/Needs correction/)).toBeNull();
  });
});
