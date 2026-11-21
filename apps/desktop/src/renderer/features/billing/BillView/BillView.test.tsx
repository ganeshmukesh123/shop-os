import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bill, BillLine, Item } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../tests/helpers/fakeShopos";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { ToastProvider } from "../../../shared/components/Toast";
import { BillView } from "./BillView";

const BILL: Bill = {
  id: "bill-1",
  number: "C1/26-27/000001",
  seriesCode: "C1",
  seq: 1,
  billDate: "2026-11-15T15:30:00",
  customerName: "Ramesh",
  paymentMode: "upi",
  linesTotalPaise: 24000,
  billDiscountPaise: 0,
  grandTotalPaise: 24000,
  status: "posted",
  cancelReason: null,
  cancelledAt: null,
};

const PIPE_LINE: BillLine = {
  id: "line-1",
  billId: "bill-1",
  lineNo: 1,
  itemId: "item-1",
  itemNameSnapshot: "Pipe 20mm",
  unitSnapshot: "pcs",
  quantityMilli: 2000,
  ratePaise: 12000,
  lineDiscountPaise: 0,
  amountPaise: 24000,
};

const NEGATIVE_ITEM: Item = {
  id: "item-1",
  name: "Pipe 20mm",
  unit: "pcs",
  allowsDecimal: false,
  pricePaise: 12000,
  stockMilli: -1000,
  active: true,
  needsCorrection: true,
};

const failure = (code: string, message: string) => () => {
  throw Object.assign(new Error(message), { code });
};

function renderBillView(
  handlers: FakeCommandHandlers = {},
  overrides: { bill?: Bill; negativeStockItems?: Item[] } = {},
) {
  const fake = installFakeShopos(handlers);
  const onNew = vi.fn();
  renderWithTheme(
    <ToastProvider>
      <BillView
        bill={overrides.bill ?? BILL}
        lines={[PIPE_LINE]}
        negativeStockItems={overrides.negativeStockItems ?? []}
        onNew={onNew}
      />
    </ToastProvider>,
  );
  const callsTo = (commandName: string) =>
    fake.calls.filter((fakeCall) => fakeCall.commandName === commandName);
  return { onNew, callsTo };
}

describe("BillView: the saved bill", () => {
  it("shows the number, the date and payment, the customer, the lines and the totals", () => {
    renderBillView();

    expect(screen.getByText("Bill saved: C1/26-27/000001")).toBeTruthy();
    expect(screen.getByText("2026-11-15 15:30 · UPI · Ramesh")).toBeTruthy();
    expect(screen.getByText("Pipe 20mm")).toBeTruthy();
    expect(screen.getByText("Grand total: ₹240.00")).toBeTruthy();
  });

  it("warns, with the words Negative stock, which items went below zero", () => {
    renderBillView({}, { negativeStockItems: [NEGATIVE_ITEM] });

    expect(screen.getByText("Negative stock")).toBeTruthy();
    expect(screen.getByText(/Pipe 20mm \(-1 pcs\)/)).toBeTruthy();
  });

  it("shows the word Cancelled on a cancelled bill", () => {
    renderBillView({}, { bill: { ...BILL, status: "cancelled", cancelReason: "wrong item" } });

    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("calls onNew when New bill is pressed", async () => {
    const { onNew } = renderBillView();

    await userEvent.click(screen.getByRole("button", { name: "New bill" }));

    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe("BillView: Print", () => {
  it("prints the saved bill as a receipt by default", async () => {
    const { callsTo } = renderBillView({ "bills.print": () => ({ printed: true }) });

    await userEvent.click(screen.getByRole("button", { name: "Print" }));

    await screen.findByRole("button", { name: "Print" });
    expect(callsTo("bills.print")[0]!.input).toEqual({ id: "bill-1", target: "receipt" });
  });

  it("says why printing failed, keeps the bill on screen, and lets the cashier try again", async () => {
    const { callsTo } = renderBillView({
      "bills.print": failure("PRINT_FAILED", "The printer is offline"),
    });

    await userEvent.click(screen.getByRole("button", { name: "Print" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/^Error The printer is offline/);
    expect(screen.getByText("Bill saved: C1/26-27/000001")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Print" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    await userEvent.click(screen.getByRole("button", { name: "Print" }));
    expect(callsTo("bills.print")).toHaveLength(2);
  });

  it("adds that the bill is saved when the failure was not the printer itself", async () => {
    renderBillView({ "bills.print": failure("INTERNAL", "Something broke") });

    await userEvent.click(screen.getByRole("button", { name: "Print" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error Something broke The bill is saved. You can try again or save a PDF.",
    );
  });
});

describe("BillView: Save PDF", () => {
  it("asks where to save, then exports the bill there and says Done", async () => {
    const { callsTo } = renderBillView({
      "system.pickPdfPath": () => ({ path: "/home/shop/bill.pdf" }),
      "bills.exportPdf": () => ({ filePath: "/home/shop/bill.pdf" }),
    });

    await userEvent.click(screen.getByRole("button", { name: "Save PDF" }));

    expect(await screen.findByText(/Done/)).toBeTruthy();
    expect(callsTo("system.pickPdfPath")[0]!.input).toEqual({ defaultName: "C1-26-27-000001.pdf" });
    expect(callsTo("bills.exportPdf")[0]!.input).toEqual({
      id: "bill-1",
      target: "receipt",
      filePath: "/home/shop/bill.pdf",
    });
    expect(screen.getByText(/PDF saved: \/home\/shop\/bill\.pdf/)).toBeTruthy();
  });

  it("does nothing more when the cashier cancels the file dialog", async () => {
    const { callsTo } = renderBillView({ "system.pickPdfPath": () => ({ path: null }) });

    await userEvent.click(screen.getByRole("button", { name: "Save PDF" }));
    await screen.findByRole("button", { name: "Save PDF" });

    expect(callsTo("bills.exportPdf")).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the reason when the file could not be written, and keeps the bill", async () => {
    renderBillView({
      "system.pickPdfPath": () => ({ path: "/locked/bill.pdf" }),
      "bills.exportPdf": failure("WRITE_FAILED", "The folder is read-only"),
    });

    await userEvent.click(screen.getByRole("button", { name: "Save PDF" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Error The folder is read-only");
    expect(screen.getByText("Bill saved: C1/26-27/000001")).toBeTruthy();
  });
});
