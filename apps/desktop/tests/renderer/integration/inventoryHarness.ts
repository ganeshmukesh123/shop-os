import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IRealShopos } from "../../helpers/realShopos";

export const navigation = () => screen.getByRole("navigation", { name: "Main" });

export async function openScreen(screenLabel: "Items" | "New bill" | "Settings") {
  await userEvent.click(within(navigation()).getByRole("button", { name: screenLabel }));
  await screen.findByRole("heading", { name: screenLabel });
}

interface INewItem {
  name: string;
  price: string;
  opening?: string;
  unit?: string;
}

/** Fills the Add item form the way the shop owner does, and saves it. */
export async function addItemOnScreen(newItem: INewItem) {
  await userEvent.click(screen.getByRole("button", { name: "Add item" }));
  await userEvent.type(screen.getByRole("textbox", { name: /Item name/ }), newItem.name);
  if (newItem.unit) {
    await userEvent.click(screen.getByRole("combobox", { name: "Unit" }));
    await userEvent.click(await screen.findByRole("option", { name: newItem.unit }));
  }
  await userEvent.type(screen.getByRole("textbox", { name: /Selling price/ }), newItem.price);
  if (newItem.opening)
    await userEvent.type(
      screen.getByRole("textbox", { name: "Opening quantity" }),
      newItem.opening,
    );
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
}

/** The table row of one item, once the real list has loaded it. */
export async function itemRow(itemName: string): Promise<HTMLElement> {
  const rowHeader = await screen.findByRole("rowheader", { name: itemName });
  return rowHeader.closest("tr")!;
}

export async function adjustStockOnScreen(itemName: string, mode: "Add" | "Set", quantity: string) {
  await userEvent.click(
    within(await itemRow(itemName)).getByRole("button", { name: "Adjust stock" }),
  );
  const modeLabel = mode === "Add" ? "Add to stock" : "Set stock to";
  await userEvent.click(screen.getByRole("radio", { name: modeLabel }));
  await userEvent.type(screen.getByRole("textbox", { name: /^Quantity/ }), quantity);
  await userEvent.type(screen.getByRole("textbox", { name: "Note (required)" }), "Counted");
  await userEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
}

export interface IMovementRow {
  movement_type: string;
  qty_base_milli: number;
  note: string | null;
}

export function readMovements(realShopos: IRealShopos): IMovementRow[] {
  return realShopos.fixture.testDb.sqlite
    .prepare(
      "select movement_type, qty_base_milli, note from stock_movement order by occurred_at, rowid",
    )
    .all() as IMovementRow[];
}
