import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "@radix-ui/themes";
import type { DraftLine, DraftLineResult } from "@shopos/core";
import { renderWithTheme } from "../../../../../tests/helpers/renderWithTheme";
import { BillLineRow } from "./BillLineRow";

const BILL_LINE: DraftLine = {
  key: "line-1",
  itemId: "item-2",
  name: "Pipe",
  unit: "pcs",
  allowsDecimal: false,
  qty: "0",
  rate: "120",
  disc: "",
  discMode: "rupees",
};

function renderRow(result: DraftLineResult = { amountPaise: 24000, error: null }) {
  const onChange = vi.fn();
  const onRemove = vi.fn();
  const onEnterQty = vi.fn();
  renderWithTheme(
    <Table.Root>
      <Table.Body>
        <BillLineRow
          line={{ ...BILL_LINE, qty: "2" }}
          result={result}
          onChange={onChange}
          onRemove={onRemove}
          onEnterQty={onEnterQty}
        />
      </Table.Body>
    </Table.Root>,
  );
  return { onChange, onRemove, onEnterQty };
}

describe("BillLineRow: the cashier's keys and clicks", () => {
  it("shows the line amount in rupees", () => {
    renderRow();
    expect(screen.getByText("₹240.00")).toBeTruthy();
  });

  it("shows a dash instead of an amount when the line is invalid", () => {
    renderRow({ amountPaise: null, error: "Quantity must be more than 0" });
    expect(screen.getByText("–")).toBeTruthy();
  });

  it("reports each typed field as a change to that field only (a focused number is replaced)", async () => {
    const { onChange } = renderRow();

    await userEvent.type(screen.getByLabelText("Qty Pipe"), "5");
    await userEvent.type(screen.getByLabelText("Rate (₹) Pipe"), "1");
    await userEvent.type(screen.getByLabelText("Discount Pipe"), "9");

    expect(onChange.mock.calls).toEqual([[{ qty: "5" }], [{ rate: "1" }], [{ disc: "9" }]]);
  });

  it("moves on when Enter is pressed in the quantity box", async () => {
    const { onEnterQty } = renderRow();

    await userEvent.type(screen.getByLabelText("Qty Pipe"), "{Enter}");

    expect(onEnterQty).toHaveBeenCalledTimes(1);
  });

  it("switches the discount between rupees and percent", async () => {
    const { onChange } = renderRow();

    await userEvent.click(screen.getByRole("radio", { name: "%" }));

    expect(onChange).toHaveBeenCalledWith({ discMode: "percent" });
  });

  it("removes the line when Remove is pressed", async () => {
    const { onRemove } = renderRow();

    await userEvent.click(screen.getByRole("button", { name: "Remove Pipe" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("BillLineRow (design guidelines 5.1, PRD NFR-011)", () => {
  it("a bill line with a problem says Error, the item and the reason", () => {
    renderWithTheme(
      <Table.Root>
        <Table.Body>
          <BillLineRow
            line={BILL_LINE}
            result={{ amountPaise: null, error: "Quantity must be more than 0" }}
            onChange={() => {}}
            onRemove={() => {}}
            onEnterQty={() => {}}
          />
        </Table.Body>
      </Table.Root>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Error Pipe: Quantity must be more than 0");
  });
});
