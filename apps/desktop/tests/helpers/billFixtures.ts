import type { Bill, BillLine } from "@shopos/core";

/** Bill C1/26-27/000001: 2 pipes at ₹120 paid by UPI for Ramesh, saved. Override only what a test is about. */
export function buildBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    number: "C1/26-27/000001",
    seriesCode: "C1",
    seq: 1,
    billDate: "2026-11-15T15:30:00",
    customerName: "Ramesh",
    docTitle: "Estimate",
    paymentMode: "upi",
    linesTotalPaise: 24_000,
    billDiscountPaise: 0,
    roundOffPaise: 0,
    grandTotalPaise: 24_000,
    status: "posted",
    cancelReason: null,
    cancelledAt: null,
    ...overrides,
  };
}

/** The one line of the bill above: 2 pcs of Pipe 20mm at ₹120. */
export function buildBillLine(overrides: Partial<BillLine> = {}): BillLine {
  return {
    id: "line-1",
    billId: "bill-1",
    lineNo: 1,
    itemId: "item-1",
    itemNameSnapshot: "Pipe 20mm",
    unitSnapshot: "pcs",
    quantityMilli: 2000,
    ratePaise: 12_000,
    lineDiscountPaise: 0,
    amountPaise: 24_000,
    ...overrides,
  };
}
