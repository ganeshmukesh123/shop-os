import type { ReactNode } from "react";
import { Theme } from "@radix-ui/themes";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import { evaluateDraft, type Bill, type DraftBill } from "@shopos/core";
import {
  installFakeShopos,
  type FakeCommandHandlers,
} from "../../../../../../../tests/helpers/fakeShopos";
import { RADIX_THEME_SETTINGS } from "../../../../../shared/theme/constants";
import { ToastProvider } from "../../../../../shared/components/Toast";
import { emptyForm, type IBillForm } from "../../../billForm";
import { useBillSave } from "./useBillSave";

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

const PIPE_DRAFT: DraftBill = {
  lines: [
    {
      key: "line-1",
      itemId: "item-1",
      name: "Pipe 20mm",
      unit: "pcs",
      allowsDecimal: false,
      qty: "2",
      rate: "120",
      disc: "",
      discMode: "rupees",
    },
  ],
  billDisc: "",
  billDiscMode: "rupees",
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <Theme {...RADIX_THEME_SETTINGS}>
      <ToastProvider>{children}</ToastProvider>
    </Theme>
  );
}

function renderSave(draft: DraftBill, handlers: FakeCommandHandlers, customerName = "") {
  const fake = installFakeShopos(handlers);
  const onSaved = vi.fn();
  const form: IBillForm = { ...emptyForm(), customerName, draft };
  const rendered = renderHook(() => useBillSave(form, evaluateDraft(draft), onSaved), {
    wrapper: Wrapper,
  });
  const savedCalls = () => fake.calls.filter((fakeCall) => fakeCall.commandName === "bills.save");
  return { ...rendered, form, onSaved, savedCalls };
}

describe("useBillSave: saving", () => {
  it("sends the lines, the payment mode and the clientBillId, then keeps the saved bill", async () => {
    const { result, form, onSaved, savedCalls } = renderSave(
      PIPE_DRAFT,
      { "bills.save": () => SAVE_RESULT },
      "  Ramesh  ",
    );

    await act(async () => result.current.save());

    expect(savedCalls()[0]!.input).toEqual({
      clientBillId: form.clientBillId,
      customerName: "Ramesh",
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: "item-1", quantityMilli: 2000, ratePaise: 12000, lineDiscountPaise: 0 }],
    });
    expect(result.current.saved).toEqual(SAVE_RESULT);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
  });

  it("sends no customer name when it is blank", async () => {
    const { result, savedCalls } = renderSave(
      PIPE_DRAFT,
      { "bills.save": () => SAVE_RESULT },
      "  ",
    );

    await act(async () => result.current.save());

    expect((savedCalls()[0]!.input as { customerName?: string }).customerName).toBeUndefined();
  });

  it("starts a new bill by forgetting the saved one", async () => {
    const { result } = renderSave(PIPE_DRAFT, { "bills.save": () => SAVE_RESULT });
    await act(async () => result.current.save());

    act(() => result.current.startNewBill());

    expect(result.current.saved).toBeNull();
  });
});

describe("useBillSave: when it cannot save", () => {
  it("says what is wrong and sends nothing when the bill is not valid", async () => {
    const emptyDraft: DraftBill = { lines: [], billDisc: "", billDiscMode: "rupees" };
    const { result, onSaved, savedCalls } = renderSave(emptyDraft, {});

    await act(async () => result.current.save());

    expect((await screen.findByRole("alert")).textContent).toBe("Error Add at least one item");
    expect(savedCalls()).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("shows the reason in an error toast and keeps nothing when the save fails", async () => {
    const failingSave = () => {
      throw Object.assign(new Error("The disk is full"), { code: "WRITE_FAILED" });
    };
    const { result, onSaved } = renderSave(PIPE_DRAFT, { "bills.save": failingSave });

    await act(async () => result.current.save());

    expect((await screen.findByRole("alert")).textContent).toBe("Error The disk is full");
    expect(result.current.saved).toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it("sends only one save when asked again before the first one finishes", async () => {
    const slowSave = async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return SAVE_RESULT;
    };
    const { result, savedCalls } = renderSave(PIPE_DRAFT, { "bills.save": slowSave });

    act(() => void result.current.save());
    await waitFor(() => expect(result.current.isSaving).toBe(true));
    await act(async () => result.current.save());
    await waitFor(() => expect(result.current.saved).not.toBeNull());

    expect(savedCalls()).toHaveLength(1);
  });
});

describe("useBillSave: Ctrl+S and Cmd+S", () => {
  it("sends only one save when Ctrl+S is pressed twice in the same moment", async () => {
    // Both key presses arrive before React re-renders, so state alone would still say "not saving".
    const slowSave = async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return SAVE_RESULT;
    };
    const { result, savedCalls } = renderSave(PIPE_DRAFT, { "bills.save": slowSave });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
    });
    await waitFor(() => expect(result.current.saved).not.toBeNull());

    expect(savedCalls()).toHaveLength(1);
  });

  it.each([
    ["Ctrl+S", { ctrlKey: true }],
    ["Cmd+S", { metaKey: true }],
  ])("%s saves the bill", async (_shortcutName, modifier) => {
    const { savedCalls } = renderSave(PIPE_DRAFT, { "bills.save": () => SAVE_RESULT });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ...modifier }));
    });

    await waitFor(() => expect(savedCalls()).toHaveLength(1));
  });

  it("does nothing for a plain S, and stops listening once the screen is gone", async () => {
    const { unmount, savedCalls } = renderSave(PIPE_DRAFT, { "bills.save": () => SAVE_RESULT });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
    });
    unmount();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
    });

    expect(savedCalls()).toHaveLength(0);
  });
});
