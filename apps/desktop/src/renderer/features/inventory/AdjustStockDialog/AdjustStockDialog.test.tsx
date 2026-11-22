import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { buildItem, NEGATIVE_INACTIVE_ITEM } from "../../../../../tests/helpers/itemFixtures";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { AdjustStockDialog } from "./AdjustStockDialog";

function renderAdjustDialog(item: Item, handlers: FakeCommandHandlers = {}) {
  const fakeShopos = installFakeShopos(handlers);
  const outcomes: string[] = [];
  renderWithTheme(
    <ToastProvider>
      <AdjustStockDialog
        item={item}
        onClose={() => outcomes.push("closed")}
        onDone={() => outcomes.push("done")}
      />
    </ToastProvider>,
  );
  return { fakeShopos, outcomes };
}

const PIPE = buildItem();
const SAVED_ADJUSTMENT = { "stock.adjust": () => ({ item: PIPE, movement: null }) };
const quantityBox = () => screen.getByRole("textbox", { name: "Quantity (pcs)" });
const noteBox = () => screen.getByRole("textbox", { name: "Note (required)" });
const adjustInputs = (calls: { commandName: string; input: unknown }[]) =>
  calls.filter((call) => call.commandName === "stock.adjust").map((call) => call.input);

describe("AdjustStockDialog (design guidelines 5.1, PRD NFR-011)", () => {
  it("an adjustment without a note says Error and what is missing", async () => {
    renderAdjustDialog(NEGATIVE_INACTIVE_ITEM);

    await userEvent.type(quantityBox(), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error A note is required");
  });
});

describe("AdjustStockDialog saves every change as a movement with a note (US-1, FR-006)", () => {
  it("shows the current stock of 10 pcs", () => {
    renderAdjustDialog(PIPE);

    expect(screen.getByText("Current stock: 10 pcs")).toBeTruthy();
  });

  it("removes 3 pcs with a minus sign in add mode", async () => {
    const { fakeShopos, outcomes } = renderAdjustDialog(PIPE, SAVED_ADJUSTMENT);
    await userEvent.type(quantityBox(), "-3");
    await userEvent.type(noteBox(), "Broken in store");

    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    await waitFor(() => expect(outcomes).toEqual(["done"]));
    expect(adjustInputs(fakeShopos.calls)).toEqual([
      { itemId: "item-pipe", mode: "add", quantityMilli: -3_000, note: "Broken in store" },
    ]);
  });

  it("sets stock to a counted 8 pcs, saving with Enter", async () => {
    const { fakeShopos } = renderAdjustDialog(PIPE, SAVED_ADJUSTMENT);
    await userEvent.click(screen.getByRole("radio", { name: "Set stock to" }));
    await userEvent.type(noteBox(), "Counted");

    await userEvent.type(quantityBox(), "8{Enter}");

    await waitFor(() =>
      expect(adjustInputs(fakeShopos.calls)).toEqual([
        { itemId: "item-pipe", mode: "set", quantityMilli: 8_000, note: "Counted" },
      ]),
    );
  });

  it("does not accept a minus sign when setting stock", async () => {
    renderAdjustDialog(PIPE);
    await userEvent.click(screen.getByRole("radio", { name: "Set stock to" }));
    await userEvent.type(quantityBox(), "-3");

    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Error Enter a quantity, for example 5 or 2.5",
    );
  });

  it("shows the reason when the adjustment is refused, and stays open", async () => {
    const { outcomes } = renderAdjustDialog(PIPE);
    await userEvent.type(quantityBox(), "5");
    await userEvent.type(noteBox(), "New box");

    await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error no fake for stock.adjust");
    expect(outcomes).toEqual([]);
  });

  it("closes on Cancel and on Escape", async () => {
    const { outcomes } = renderAdjustDialog(PIPE);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");

    expect(outcomes).toEqual(["closed", "closed"]);
  });
});
