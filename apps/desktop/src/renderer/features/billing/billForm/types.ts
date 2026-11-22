import type { DraftBill, PaymentMode } from "@shopos/core";

export interface IBillForm {
  /** Made when the bill is started; sent with the save so a retry can never create a second bill. */
  clientBillId: string;
  draft: DraftBill;
  customerName: string;
  paymentMode: PaymentMode;
}
