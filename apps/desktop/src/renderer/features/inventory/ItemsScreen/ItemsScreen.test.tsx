import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { buildItem, NEGATIVE_INACTIVE_ITEM } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { ItemsScreen } from "./ItemsScreen";

const PIPE = buildItem();

function renderItemsScreen(items: Item[], handlers: FakeCommandHandlers = {}) {
  const fakeShopos = installFakeShopos({
    "items.list": () => ({ items, total: items.length }),
    ...handlers,
  });
  renderWithTheme(
    <ToastProvider>
      <ItemsScreen />
    </ToastProvider>,
  );
  return fakeShopos;
}

const listInputs = (calls: { commandName: string; input: unknown }[]) =>
  calls.filter((call) => call.commandName === "items.list").map((call) => call.input);

const pipeRow = async () =>
  (await screen.findByRole("rowheader", { name: "PVC pipe" })).closest("tr")!;

describe("ItemsScreen (design guidelines 5.1, PRD NFR-011)", () => {
  it("an item with negative stock and an inactive item each carry a word", async () => {
    renderItemsScreen([NEGATIVE_INACTIVE_ITEM]);

    expect(await screen.findByText("Negative stock: needs correction")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });
});

describe("ItemsScreen list, search and filters (US-1)", () => {
  it("lists each item with its price and stock, and counts them", async () => {
    renderItemsScreen([PIPE]);

    const row = await pipeRow();

    expect(within(row).getByText("₹120.00")).toBeTruthy();
    expect(within(row).getByText("10")).toBeTruthy();
    expect(screen.getByText("1 item")).toBeTruthy();
  });

  it("invites the first item when the shop has none", async () => {
    renderItemsScreen([]);

    expect(await screen.findByText("No items yet. Add your first item.")).toBeTruthy();
    expect(screen.getByText("0 items")).toBeTruthy();
  });

  it("searches by name and says when nothing matches", async () => {
    const fakeShopos = renderItemsScreen([]);

    await userEvent.type(screen.getByRole("textbox", { name: "Search items by name" }), "tap");

    expect(await screen.findByText("No items match.")).toBeTruthy();
    expect(listInputs(fakeShopos.calls).at(-1)).toMatchObject({ query: "tap" });
  });

  it("filters to inactive and needs-correction items", async () => {
    const fakeShopos = renderItemsScreen([]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Show inactive" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Needs correction" }));

    await waitFor(() =>
      expect(listInputs(fakeShopos.calls).at(-1)).toMatchObject({
        includeInactive: true,
        needsCorrection: true,
      }),
    );
  });
});

describe("ItemsScreen actions (US-1, FR-006)", () => {
  it("deactivates an active item and reloads the list", async () => {
    const fakeShopos = renderItemsScreen([PIPE], {
      "items.update": () => ({ item: { ...PIPE, active: false } }),
    });

    await userEvent.click(within(await pipeRow()).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(listInputs(fakeShopos.calls)).toHaveLength(2));
    expect(fakeShopos.calls).toContainEqual({
      commandName: "items.update",
      input: { id: "item-pipe", active: false },
    });
  });

  it("shows the reason when reactivating fails", async () => {
    renderItemsScreen([{ ...PIPE, active: false }]);

    await userEvent.click(within(await pipeRow()).getByRole("button", { name: "Reactivate" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error no fake for items.update");
  });

  it("opens the add form and closes it on Cancel", async () => {
    renderItemsScreen([]);

    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByRole("dialog", { name: "Add item" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("edits an item and reloads the list when it is saved", async () => {
    const fakeShopos = renderItemsScreen([PIPE], { "items.update": () => ({ item: PIPE }) });

    await userEvent.click(within(await pipeRow()).getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(listInputs(fakeShopos.calls)).toHaveLength(2);
  });

  it("adjusts stock and reloads the list when the adjustment is saved", async () => {
    const fakeShopos = renderItemsScreen([PIPE], {
      "stock.adjust": () => ({ item: PIPE, movement: null }),
    });

    await userEvent.click(within(await pipeRow()).getByRole("button", { name: "Adjust stock" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Quantity (pcs)" }), "5");
    await userEvent.type(screen.getByRole("textbox", { name: "Note (required)" }), "New box");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(listInputs(fakeShopos.calls)).toHaveLength(2);
  });

  it("closes the adjust dialog on Cancel", async () => {
    renderItemsScreen([PIPE]);

    await userEvent.click(within(await pipeRow()).getByRole("button", { name: "Adjust stock" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
