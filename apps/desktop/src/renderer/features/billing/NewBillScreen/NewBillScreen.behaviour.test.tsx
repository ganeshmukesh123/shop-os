import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bill, Item } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { NewBillScreen } from "./NewBillScreen";

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

const SAVED_BILL: Bill = {
  id: "bill-1",
  number: "C1/26-27/000001",
  seriesCode: "C1",
  seq: 1,
  billDate: "2026-11-15T15:00:00",
  customerName: null,
  paymentMode: "cash",
  linesTotalPaise: 24000,
  billDiscountPaise: 0,
  grandTotalPaise: 24000,
  status: "posted",
  cancelReason: null,
  cancelledAt: null,
};

const SAVE_RESULT = { bill: SAVED_BILL, lines: [], negativeStockItems: [] };

const RECOVERED_DRAFT = {
  clientBillId: "client-bill-recovered",
  draft: {
    lines: [
      {
        key: "line-1",
        itemId: "item-1",
        name: "Pipe 20mm",
        unit: "pcs",
        allowsDecimal: false,
        qty: "3",
        rate: "120.00",
        disc: "",
        discMode: "rupees",
      },
    ],
    billDisc: "",
    billDiscMode: "rupees",
  },
  customerName: "",
  paymentMode: "cash",
};

const SEARCH_LABEL = /Type 2 or more letters/;

function renderBillScreen(extraHandlers: FakeCommandHandlers = {}) {
  const fake = installFakeShopos({
    "bills.draft.load": () => ({ payload: null }),
    "bills.draft.save": () => ({}),
    "items.list": () => ({ items: [PIPE], total: 1 }),
    ...extraHandlers,
  });
  renderWithTheme(
    <ToastProvider>
      <NewBillScreen />
    </ToastProvider>,
  );
  return fake;
}

async function addPipeWithQuantity(quantityText: string) {
  await userEvent.type(screen.getByRole("textbox", { name: SEARCH_LABEL }), "pi{Enter}");
  const quantityField = await screen.findByRole("textbox", { name: "Qty Pipe 20mm" });
  await userEvent.clear(quantityField);
  await userEvent.type(quantityField, quantityText);
}

const savedBillInputs = (fake: ReturnType<typeof installFakeShopos>) =>
  fake.calls.filter((fakeCall) => fakeCall.commandName === "bills.save");

describe("new bill screen: totals", () => {
  it("shows the total and the grand total of the lines, in rupees", async () => {
    renderBillScreen();

    await addPipeWithQuantity("2");

    const totalLine = screen.getByText(
      (_text, element) => element?.tagName === "SPAN" && element.textContent === "Total: ₹240.00",
    );
    expect(totalLine).toBeTruthy();
    expect(screen.getByText("Grand total: ₹240.00")).toBeTruthy();
  });

  it("takes a rupee discount off the grand total", async () => {
    renderBillScreen();
    await addPipeWithQuantity("2");

    await userEvent.type(screen.getByRole("textbox", { name: "Bill discount" }), "40");

    expect(screen.getByText("Grand total: ₹200.00")).toBeTruthy();
    expect(screen.getByText("-₹40.00")).toBeTruthy();
  });
});

describe("new bill screen: save", () => {
  it("sends the bill once, with the lines and a clientBillId, then shows the saved bill", async () => {
    const fake = renderBillScreen({ "bills.save": () => SAVE_RESULT });
    await addPipeWithQuantity("2");

    await userEvent.click(screen.getByRole("button", { name: /Save bill/ }));

    expect(await screen.findByText(/Bill saved: C1\/26-27\/000001/)).toBeTruthy();
    const sent = savedBillInputs(fake);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.input).toEqual({
      clientBillId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      customerName: undefined,
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: "item-1", quantityMilli: 2000, ratePaise: 12000, lineDiscountPaise: 0 }],
    });
  });

  it("saves only once when Save is pressed and then Ctrl+S before the first save finishes", async () => {
    // The test decides when the first save finishes, so Ctrl+S always lands while it is pending.
    let finishFirstSave: (result: typeof SAVE_RESULT) => void = () => undefined;
    const pendingSave = () =>
      new Promise<typeof SAVE_RESULT>((resolve) => {
        finishFirstSave = resolve;
      });
    const fake = renderBillScreen({ "bills.save": pendingSave });
    await addPipeWithQuantity("1");

    await userEvent.click(screen.getByRole("button", { name: /Save bill/ }));
    await userEvent.keyboard("{Control>}s{/Control}");
    const callsWhilePending = savedBillInputs(fake).length;
    finishFirstSave(SAVE_RESULT);

    expect(callsWhilePending).toBe(1);
    expect(await screen.findByText(/Bill saved/)).toBeTruthy();
    expect(savedBillInputs(fake)).toHaveLength(1);
  });

  it("shows the reason in an error toast and keeps the bill when the save fails", async () => {
    const failingSave = () => {
      throw Object.assign(new Error("The disk is full"), { code: "WRITE_FAILED" });
    };
    renderBillScreen({ "bills.save": failingSave });
    await addPipeWithQuantity("2");

    await userEvent.click(screen.getByRole("button", { name: /Save bill/ }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error The disk is full");
    expect(screen.getByRole("textbox", { name: "Qty Pipe 20mm" })).toBeTruthy();
  });
});

describe("new bill screen: an unsaved bill from before", () => {
  const draftHandlers: FakeCommandHandlers = {
    "bills.draft.load": () => ({ payload: RECOVERED_DRAFT }),
  };

  it("offers the unsaved bill and puts its lines back when Continue is chosen", async () => {
    renderBillScreen(draftHandlers);

    expect(await screen.findByText("Unsaved bill found")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Continue bill" }));

    const quantityField = await screen.findByRole("textbox", { name: "Qty Pipe 20mm" });
    expect((quantityField as HTMLInputElement).value).toBe("3");
    expect(screen.queryByText("Unsaved bill found")).toBeNull();
  });

  it("throws the unsaved bill away when Discard is chosen", async () => {
    const fake = renderBillScreen(draftHandlers);
    await screen.findByText("Unsaved bill found");

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(screen.queryByText("Unsaved bill found")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Qty Pipe 20mm" })).toBeNull();
    const clearedDraft = fake.calls.find((fakeCall) => fakeCall.commandName === "bills.draft.save");
    expect(clearedDraft?.input).toEqual({ payload: null });
  });
});
