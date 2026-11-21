import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Item } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { ItemForm } from "./ItemForm";

const PIPE: Item = {
  id: "item-1",
  name: "Pipe 20mm",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 12000,
  stockMilli: 10000,
  active: true,
  needsCorrection: false,
};

const CREATED = { item: PIPE };

function renderForm(handlers: FakeCommandHandlers = {}, item?: Item) {
  const fake = installFakeShopos(handlers);
  const onClose = vi.fn();
  const onDone = vi.fn();
  renderWithTheme(
    <ToastProvider>
      <ItemForm item={item} onClose={onClose} onDone={onDone} />
    </ToastProvider>,
  );
  const callsTo = (commandName: string) =>
    fake.calls.filter((fakeCall) => fakeCall.commandName === commandName);
  return { onClose, onDone, callsTo };
}

const field = (labelText: RegExp) => screen.getByRole("textbox", { name: labelText });
const pressSave = () => userEvent.click(screen.getByRole("button", { name: "Save" }));

describe("item form: adding an item", () => {
  it("sends the name, unit, price in paise and opening stock in thousandths, then closes", async () => {
    const { callsTo, onDone } = renderForm({ "items.create": () => CREATED });

    await userEvent.type(field(/Item name/), "Pipe 20mm");
    await userEvent.type(field(/Selling price/), "120");
    await userEvent.type(field(/Opening/), "10");
    await pressSave();

    expect(callsTo("items.create")[0]!.input).toEqual({
      name: "Pipe 20mm",
      unit: "pcs",
      allowsDecimal: false,
      pricePaise: 12000,
      openingQtyMilli: 10000,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Pipe 20mm saved")).toBeTruthy();
  });

  it("saves when Enter is pressed in a field", async () => {
    const { callsTo } = renderForm({ "items.create": () => CREATED });

    await userEvent.type(field(/Item name/), "Pipe 20mm");
    await userEvent.type(field(/Selling price/), "120{Enter}");

    expect(callsTo("items.create")).toHaveLength(1);
  });

  it("says what is missing and sends nothing when the name and price are empty", async () => {
    const { callsTo, onDone } = renderForm();

    await pressSave();

    const messages = (await screen.findAllByRole("alert")).map((alert) => alert.textContent);
    expect(messages).toEqual([
      "Error Enter the item name",
      "Error Enter the price in rupees, for example 120 or 49.50",
    ]);
    expect(callsTo("items.create")).toHaveLength(0);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("refuses a fraction for a unit that takes whole numbers only", async () => {
    renderForm();

    await userEvent.type(field(/Item name/), "Pipe 20mm");
    await userEvent.type(field(/Selling price/), "120");
    await userEvent.type(field(/Opening/), "2.5");
    await pressSave();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error This unit accepts whole numbers only",
    );
  });

  it("refuses an opening quantity that is not a number", async () => {
    renderForm();

    await userEvent.type(field(/Item name/), "Pipe 20mm");
    await userEvent.type(field(/Selling price/), "120");
    await userEvent.type(field(/Opening/), "abc");
    await pressSave();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error Enter the opening quantity as a number, for example 10 or 2.5",
    );
  });

  it("lists the items with the same name, with a Duplicate name word, and stays open", async () => {
    const duplicateError = Object.assign(new Error("Name already used"), {
      code: "DUPLICATE_NAME",
      details: [PIPE],
    });
    const { onDone } = renderForm({
      "items.create": () => {
        throw duplicateError;
      },
    });
    await userEvent.type(field(/Item name/), "Pipe 20mm");
    await userEvent.type(field(/Selling price/), "120");

    await pressSave();

    const warning = await screen.findByText(/Pipe 20mm \(10 pcs in stock\)/);
    expect(warning.textContent).toContain("Duplicate name");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows any other failure as an error", async () => {
    renderForm({
      "items.create": () => {
        throw Object.assign(new Error("The disk is full"), { code: "WRITE_FAILED" });
      },
    });
    await userEvent.type(field(/Item name/), "Pipe 20mm");
    await userEvent.type(field(/Selling price/), "120");

    await pressSave();

    expect((await screen.findByRole("alert")).textContent).toBe("Error The disk is full");
  });
});

describe("item form: editing an item", () => {
  it("starts with the item's values and the current stock, and has no opening quantity", () => {
    renderForm({}, PIPE);

    expect((field(/Item name/) as HTMLInputElement).value).toBe("Pipe 20mm");
    expect((field(/Selling price/) as HTMLInputElement).value).toBe("120.00");
    expect(screen.getByText(/Current stock 10 pcs/)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /Opening/ })).toBeNull();
  });

  it("sends the changes with the item's id, and never the stock", async () => {
    const { callsTo, onDone } = renderForm({ "items.update": () => ({ item: PIPE }) }, PIPE);

    await userEvent.clear(field(/Selling price/));
    await userEvent.type(field(/Selling price/), "125.50");
    await pressSave();

    expect(callsTo("items.update")[0]!.input).toEqual({
      id: "item-1",
      name: "Pipe 20mm",
      unit: "pcs",
      pricePaise: 12550,
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
