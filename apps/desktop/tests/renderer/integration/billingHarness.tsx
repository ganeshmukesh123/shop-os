import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../src/renderer/app/App";
import { ToastProvider } from "../../../src/renderer/shared/components/Toast";
import { renderWithTheme } from "../../helpers/renderWithTheme";
import type { IRealShopos } from "../../helpers/realShopos";

/** PVC pipe: pcs at ₹120 with 10 in stock (opening movement of 10000). */
export const PIPE = { name: "PVC pipe", unit: "pcs", pricePaise: 12_000, openingQtyMilli: 10_000 };

export function renderShopApp() {
  return renderWithTheme(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

/** Types two or more letters, waits for the real search, and adds the item with Enter. */
export async function addToBill(searchText: string, itemName: string, quantity: string) {
  const searchBox = await screen.findByRole("textbox", { name: /Type 2 or more letters/ });
  await userEvent.type(searchBox, searchText);
  await screen.findByRole("option", { name: new RegExp(itemName) });
  await userEvent.keyboard("{Enter}");
  const quantityField = screen.getByRole("textbox", { name: `Qty ${itemName}` });
  await userEvent.clear(quantityField);
  await userEvent.type(quantityField, quantity);
}

export async function choosePayment(paymentLabel: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Payment" }));
  await userEvent.click(await screen.findByRole("option", { name: paymentLabel }));
}

export const saveWithKeyboard = () => userEvent.keyboard("{Control>}s{/Control}");

/**
 * The Error message, picked by its word: other alerts may be on screen too, such as the real clock
 * check's "Time zone differs" when the machine is not on the shop's zone (a UTC CI runner).
 */
export async function findErrorAlert(): Promise<HTMLElement> {
  return screen.findByRole("alert", {
    name: (_accessibleName, element) => element.textContent?.startsWith("Error") ?? false,
  });
}

export interface IBillRow {
  bill_no: string;
  seq: number;
  subtotal_paise: number;
  bill_discount_paise: number;
  round_off_paise: number;
  total_paise: number;
  client_bill_id: string;
}

export function readBills(realShopos: IRealShopos): IBillRow[] {
  return realShopos.fixture.testDb.sqlite
    .prepare(
      `select bill_no, seq, subtotal_paise, bill_discount_paise, round_off_paise, total_paise,
              client_bill_id
         from bill order by seq`,
    )
    .all() as IBillRow[];
}

/** Stock as the app reports it: the sum of the item's movements. */
export async function stockOf(realShopos: IRealShopos, itemName: string): Promise<number> {
  const listed = await realShopos.fixture.handlers["items.list"]({
    query: itemName,
    limit: 1,
    offset: 0,
  });
  if (!listed.ok) throw new Error(listed.message);
  return listed.data.items[0]!.stockMilli;
}
