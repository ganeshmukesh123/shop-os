import { screen } from "@testing-library/react";
import { Table } from "@radix-ui/themes";
import type { DraftLine } from "@shopos/core";
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
