import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { evaluateDraft, type DraftLine } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { BillLinesTable } from "./BillLinesTable";

function buildLine(lineKey: string, itemName: string, quantityText: string): DraftLine {
  return {
    key: lineKey,
    itemId: `item-${lineKey}`,
    name: itemName,
    unit: "pcs",
    allowsDecimal: false,
    qty: quantityText,
    rate: "120",
    disc: "",
    discMode: "rupees",
  };
}

function renderTable(lines: DraftLine[]) {
  const callbacks = {
    onLineChange: vi.fn(),
    onLineRemove: vi.fn(),
    onEnterQty: vi.fn(),
    onQtyFieldRef: vi.fn(),
  };
  const { lines: results } = evaluateDraft({ lines, billDisc: "", billDiscMode: "rupees" });
  renderWithTheme(<BillLinesTable lines={lines} results={results} {...callbacks} />);
  return callbacks;
}

describe("BillLinesTable", () => {
  it("shows a hint, and no table, when the bill has no lines yet", () => {
    renderTable([]);

    expect(screen.getByText("Search for an item above to start the bill.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the column words and one row per line, each with its amount", () => {
    renderTable([buildLine("a", "Pipe 20mm", "2"), buildLine("b", "Elbow", "1")]);

    ["Item", "Qty", "Rate (₹)", "Discount", "Amount"].forEach((columnWord) =>
      expect(screen.getByRole("columnheader", { name: columnWord })).toBeTruthy(),
    );
    expect(screen.getByText("₹240.00")).toBeTruthy();
    expect(screen.getByText("₹120.00")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Qty Elbow" })).toBeTruthy();
  });

  it("reports an edit with the key of the line it belongs to (focus selects the old value, so typing replaces it)", async () => {
    const callbacks = renderTable([buildLine("a", "Pipe 20mm", "2"), buildLine("b", "Elbow", "1")]);

    await userEvent.type(screen.getByRole("textbox", { name: "Qty Elbow" }), "5");

    expect(callbacks.onLineChange).toHaveBeenCalledWith("b", { qty: "5" });
  });

  it("reports which line to remove", async () => {
    const callbacks = renderTable([buildLine("a", "Pipe 20mm", "2"), buildLine("b", "Elbow", "1")]);

    await userEvent.click(screen.getByRole("button", { name: "Remove Pipe 20mm" }));

    expect(callbacks.onLineRemove).toHaveBeenCalledWith("a");
  });

  it("calls onEnterQty when Enter is pressed in a quantity field", async () => {
    const callbacks = renderTable([buildLine("a", "Pipe 20mm", "2")]);

    await userEvent.type(screen.getByRole("textbox", { name: "Qty Pipe 20mm" }), "{Enter}");

    expect(callbacks.onEnterQty).toHaveBeenCalledTimes(1);
  });

  it("hands each quantity field to the screen under its line key", () => {
    const callbacks = renderTable([buildLine("a", "Pipe 20mm", "2")]);

    expect(callbacks.onQtyFieldRef).toHaveBeenCalledWith("a", expect.any(HTMLInputElement));
  });
});
