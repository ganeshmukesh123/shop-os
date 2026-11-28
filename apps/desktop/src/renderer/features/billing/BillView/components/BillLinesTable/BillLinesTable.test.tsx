import { screen } from "@testing-library/react";
import type { BillLine } from "@shopos/core";
import { renderWithTheme } from "../../../../../../../tests/helpers/renderWithTheme";
import { uiText } from "../../../../../shared/text/strings";
import { BillLinesTable } from "./BillLinesTable";

/** Spec 002 T067: a tinted can shows its colorants and that it cannot be returned, in words. */
const TINTED: BillLine = {
  id: "line-1",
  billId: "bill-1",
  lineNo: 1,
  itemId: "royale-pastel-4l",
  itemNameSnapshot: "Royale Pastel 4 L",
  unitSnapshot: "pcs",
  quantityMilli: 1_000,
  ratePaise: 151_000,
  lineDiscountPaise: 0,
  amountPaise: 151_000,
  tint: {
    colorants: [
      { name: "Blue", qtyMilli: 12_500 },
      { name: "Black", qtyMilli: 750 },
    ],
  },
};

describe("BillLinesTable: tinted lines (spec 002 T067)", () => {
  it("shows the colorants per can and Non-returnable (tinted) under the can", () => {
    renderWithTheme(<BillLinesTable lines={[TINTED]} />);

    expect(screen.getByText("Blue 12.5 ml, Black 0.75 ml per can")).toBeTruthy();
    expect(screen.getByText(uiText.bill.tint.nonReturnable)).toBeTruthy();
  });
});
