import { act, renderHook } from "@testing-library/react";
import type { Item } from "@shopos/core";
import { useBillForm } from "./useBillForm";

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

const ELBOW: Item = { ...PIPE, id: "item-2", name: "Elbow", pricePaise: 4500 };

function renderBillForm() {
  const onLineToFocus = vi.fn();
  const rendered = renderHook(() => useBillForm(onLineToFocus));
  return { ...rendered, onLineToFocus };
}

describe("useBillForm: adding items", () => {
  it("adds a line with the item's name, unit, price in rupees and quantity 1", () => {
    const { result } = renderBillForm();

    act(() => result.current.addItem(PIPE));

    expect(result.current.form.draft.lines).toEqual([
      expect.objectContaining({
        itemId: "item-1",
        name: "Pipe 20mm",
        unit: "pcs",
        allowsDecimal: false,
        qty: "1",
        rate: "120.00",
        disc: "",
        discMode: "rupees",
      }),
    ]);
  });

  it("tells the screen which line to focus, for a new line and for one added again", () => {
    const { result, onLineToFocus } = renderBillForm();

    act(() => result.current.addItem(PIPE));
    const pipeLineKey = result.current.form.draft.lines[0]!.key;
    act(() => result.current.addItem(ELBOW));
    act(() => result.current.addItem(PIPE));

    expect(onLineToFocus).toHaveBeenNthCalledWith(1, pipeLineKey);
    expect(onLineToFocus).toHaveBeenNthCalledWith(3, pipeLineKey);
    expect(onLineToFocus).toHaveBeenCalledTimes(3);
  });

  it("adds one more to the quantity when the same item is added again, with no second line", () => {
    const { result } = renderBillForm();

    act(() => result.current.addItem(PIPE));
    act(() => result.current.addItem(PIPE));

    expect(result.current.form.draft.lines).toHaveLength(1);
    expect(result.current.form.draft.lines[0]!.qty).toBe("2");
  });

  it("starts again from 1 when the quantity typed so far cannot be read as a number", () => {
    const { result } = renderBillForm();
    act(() => result.current.addItem(PIPE));
    const pipeLineKey = result.current.form.draft.lines[0]!.key;
    act(() => result.current.patchLine(pipeLineKey, { qty: "abc" }));

    act(() => result.current.addItem(PIPE));

    expect(result.current.form.draft.lines[0]!.qty).toBe("1");
  });
});

describe("useBillForm: changing the bill", () => {
  it("changes only the line it is told to", () => {
    const { result } = renderBillForm();
    act(() => result.current.addItem(PIPE));
    act(() => result.current.addItem(ELBOW));
    const [pipeLine, elbowLine] = result.current.form.draft.lines;

    act(() => result.current.patchLine(elbowLine!.key, { qty: "5", rate: "50" }));

    expect(result.current.form.draft.lines[0]).toEqual(pipeLine);
    expect(result.current.form.draft.lines[1]).toMatchObject({ qty: "5", rate: "50" });
  });

  it("removes the line with the given key", () => {
    const { result } = renderBillForm();
    act(() => result.current.addItem(PIPE));
    act(() => result.current.addItem(ELBOW));
    const pipeLineKey = result.current.form.draft.lines[0]!.key;

    act(() => result.current.removeLine(pipeLineKey));

    expect(result.current.form.draft.lines.map((draftLine) => draftLine.name)).toEqual(["Elbow"]);
  });

  it("updates the customer, the payment mode and the bill discount without touching the lines", () => {
    const { result } = renderBillForm();
    act(() => result.current.addItem(PIPE));

    act(() => result.current.updateForm({ customerName: "Ramesh", paymentMode: "upi" }));
    act(() => result.current.updateDraft({ billDisc: "10", billDiscMode: "percent" }));

    expect(result.current.form).toMatchObject({ customerName: "Ramesh", paymentMode: "upi" });
    expect(result.current.form.draft).toMatchObject({ billDisc: "10", billDiscMode: "percent" });
    expect(result.current.form.draft.lines).toHaveLength(1);
  });

  it("starts a fresh bill with a new clientBillId on resetForm", () => {
    const { result } = renderBillForm();
    const firstClientBillId = result.current.form.clientBillId;
    act(() => result.current.addItem(PIPE));

    act(() => result.current.resetForm());

    expect(result.current.form.draft.lines).toEqual([]);
    expect(result.current.form.clientBillId).not.toBe(firstClientBillId);
  });

  it("replaces the whole form with the one it is given", () => {
    const { result } = renderBillForm();
    act(() => result.current.addItem(PIPE));
    const replacement = { ...result.current.form, customerName: "Recovered", clientBillId: "kept" };

    act(() => result.current.replaceForm(replacement));

    expect(result.current.form).toEqual(replacement);
  });
});

describe("useBillForm: the totals", () => {
  it("works the totals out from the lines and the discount", () => {
    const { result } = renderBillForm();
    act(() => result.current.addItem(PIPE));
    const pipeLineKey = result.current.form.draft.lines[0]!.key;

    act(() => result.current.patchLine(pipeLineKey, { qty: "2" }));
    act(() => result.current.updateDraft({ billDisc: "40" }));

    expect(result.current.evaluation).toMatchObject({
      linesTotalPaise: 24000,
      billDiscountPaise: 4000,
      grandTotalPaise: 20000,
      valid: true,
    });
  });
});
