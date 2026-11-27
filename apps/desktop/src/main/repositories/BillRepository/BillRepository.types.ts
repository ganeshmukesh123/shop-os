import type { PaymentMode } from "@shopos/core";

/** What BillingService hands BillRepository to insert one saved bill and its lines. */
export interface INewBill {
  number: string;
  seriesCode: string;
  financialYear: string;
  numberSeriesId: string;
  seq: number;
  /** The UTC instant of the save, epoch milliseconds. */
  billedAt: number;
  /** That instant's calendar date in the shop's time zone, YYYY-MM-DD. */
  businessDate: string;
  customerName: string | null;
  clientBillId: string;
  /** The shop's document title when the bill was saved; stored so a reprint is identical. */
  docTitle: string;
  /** The shop's zone when the bill was saved; its date and time are always shown in it. */
  timeZone: string;
  paymentMode: PaymentMode;
  linesTotalPaise: number;
  billDiscountPaise: number;
  /** Signed difference to the nearest rupee, 0 when rounding is off. */
  roundOffPaise: number;
  /** The final total: lines total - discount + round-off. */
  grandTotalPaise: number;
}

export interface INewLine {
  lineNo: number;
  itemId: string;
  itemNameSnapshot: string;
  unitSnapshot: string;
  quantityMilli: number;
  ratePaise: number;
  lineDiscountPaise: number;
  amountPaise: number;
}
