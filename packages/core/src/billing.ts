import { CoreError } from "./errors";
import { assertPaise, mulQtyRate, percentOfPaise, subPaise } from "./money";

export interface LineInput {
  quantityMilli: number;
  ratePaise: number;
  lineDiscountPaise: number;
}

/** Line amount = quantity x rate (rounded half up) minus line discount. */
export function computeLine(line: LineInput): number {
  if (!Number.isSafeInteger(line.quantityMilli) || line.quantityMilli <= 0) {
    throw new CoreError("INVALID_QUANTITY", "quantity must be greater than zero");
  }
  assertPaise(line.ratePaise, "rate");
  if (line.ratePaise < 0) throw new CoreError("INVALID_AMOUNT", "rate cannot be negative");
  assertPaise(line.lineDiscountPaise, "discount");
  const gross = mulQtyRate(line.quantityMilli, line.ratePaise);
  if (line.lineDiscountPaise < 0 || line.lineDiscountPaise > gross) {
    throw new CoreError(
      "INVALID_DISCOUNT",
      "discount cannot be negative or exceed the line amount",
    );
  }
  return subPaise(gross, line.lineDiscountPaise);
}

export interface BillTotals {
  lineAmounts: number[];
  linesTotalPaise: number;
  billDiscountPaise: number;
  grandTotalPaise: number;
}

export function computeBill(input: { lines: LineInput[]; billDiscountPaise: number }): BillTotals {
  if (input.lines.length === 0) throw new CoreError("EMPTY_BILL", "a bill needs at least one line");
  const lineAmounts = input.lines.map(computeLine);
  const linesTotalPaise = lineAmounts.reduce(
    (runningTotalPaise, lineAmountPaise) => runningTotalPaise + lineAmountPaise,
    0,
  );
  assertPaise(linesTotalPaise);
  assertPaise(input.billDiscountPaise, "bill discount");
  if (input.billDiscountPaise < 0 || input.billDiscountPaise > linesTotalPaise) {
    throw new CoreError(
      "INVALID_DISCOUNT",
      "bill discount cannot be negative or exceed the lines total",
    );
  }
  return {
    lineAmounts,
    linesTotalPaise,
    billDiscountPaise: input.billDiscountPaise,
    grandTotalPaise: linesTotalPaise - input.billDiscountPaise,
  };
}

/** Convert a percent (basis points) of an amount into a rupee discount in paise. */
export function discountFromPercent(amountPaise: number, percentBp: number): number {
  return percentOfPaise(amountPaise, percentBp);
}
