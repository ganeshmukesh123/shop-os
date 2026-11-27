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
const isErrorAlert = (_accessibleName: string, element: Element) =>
  element.textContent?.startsWith("Error") ?? false;

export async function findErrorAlert(): Promise<HTMLElement> {
  return screen.findByRole("alert", { name: isErrorAlert });
}

/** Every Error message on screen, for a refusal shown both on the line and as a toast. */
export async function findErrorAlertTexts(): Promise<string[]> {
  const errorAlerts = await screen.findAllByRole("alert", { name: isErrorAlert });
  return errorAlerts.map((errorAlert) => errorAlert.textContent ?? "");
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

/**
 * Stock as the app reports it: the cached stock on the item. That it equals the sum of the item's
 * movements is checked separately after every test (`checkLedgerAfterEachTest`, IT-STK-01).
 */
export async function stockOf(realShopos: IRealShopos, itemName: string): Promise<number> {
  const listed = await realShopos.fixture.handlers["items.list"]({
    query: itemName,
    includeInactive: true,
    limit: 50,
    offset: 0,
  });
  if (!listed.ok) throw new Error(listed.message);
  // The search matches part of a name; "PVC pipe" must not pick "PVC pipe 20mm".
  const matchingItem = listed.data.items.find((listedItem) => listedItem.name === itemName);
  if (!matchingItem) throw new Error(`No item named ${itemName}`);
  return matchingItem.stockMilli;
}
