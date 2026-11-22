import { and, asc, eq, sql } from "drizzle-orm";
import { CoreError, DEFAULT_TIME_ZONE, localIsoOf } from "@shopos/core";
import type { Bill, BillLine, PaymentMode } from "@shopos/core";
import type { Handle } from "../db/connection";
import { isoOfMs, newId, nowMs } from "../db/ids";
import { bill, billLine, billTender, draftBill, numberSeries } from "../db/schema";
import type { Ctx } from "../db/seed";

/** The payment mode is not on the bill row: it is the label on the bill's tender (D18). */
export const toBill = (billRow: typeof bill.$inferSelect, paymentMode: PaymentMode): Bill => ({
  id: billRow.id,
  number: billRow.billNo,
  seriesCode: billRow.counterCode,
  seq: billRow.seq,
  billDate: localIsoOf(billRow.billedAt, DEFAULT_TIME_ZONE),
  customerName: billRow.customerName,
  paymentMode,
  linesTotalPaise: billRow.subtotalPaise,
  billDiscountPaise: billRow.billDiscountPaise,
  grandTotalPaise: billRow.totalPaise,
  status: billRow.status as Bill["status"],
  cancelReason: billRow.cancelReason,
  cancelledAt: billRow.cancelledAt === null ? null : isoOfMs(billRow.cancelledAt),
});

const toLine = (lineRow: typeof billLine.$inferSelect): BillLine => ({
  id: lineRow.id,
  billId: lineRow.billId,
  lineNo: lineRow.lineNo,
  itemId: lineRow.variantId,
  itemNameSnapshot: lineRow.itemNameSnapshot,
  unitSnapshot: lineRow.unitSnapshot,
  quantityMilli: lineRow.qtyBaseMilli,
  ratePaise: lineRow.unitPricePaise,
  lineDiscountPaise: lineRow.lineDiscountPaise,
  amountPaise: lineRow.amountPaise,
});

export interface NewBill {
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
  paymentMode: PaymentMode;
  linesTotalPaise: number;
  billDiscountPaise: number;
  grandTotalPaise: number;
}

export interface NewLine {
  lineNo: number;
  itemId: string;
  itemNameSnapshot: string;
  unitSnapshot: string;
  quantityMilli: number;
  ratePaise: number;
  lineDiscountPaise: number;
  amountPaise: number;
}

/** Saved bills are insert-only here; the database triggers also forbid edits and deletes. */
export class BillRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  private base() {
    const now = nowMs();
    return {
      id: newId(),
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Increment and return the next sequence of a series, with the series id the bill will point at.
   * The series keeps the template last used with it. Must run inside the bill-save transaction.
   */
  nextSeq(
    counterCode: string,
    financialYear: string,
    template: string,
  ): { seq: number; numberSeriesId: string } {
    const now = nowMs();
    const row = this.databaseHandle
      .insert(numberSeries)
      .values({ ...this.base(), counterCode, financialYear, template, lastSeq: 1 })
      .onConflictDoUpdate({
        target: [numberSeries.shopId, numberSeries.counterCode, numberSeries.financialYear],
        set: { lastSeq: sql`${numberSeries.lastSeq} + 1`, template, updatedAt: now },
      })
      .returning({ seq: numberSeries.lastSeq, numberSeriesId: numberSeries.id })
      .get();
    return row;
  }

  /**
   * The domain names (number, seriesCode, ...) are stored as bill_no, counter_code, ... (D18).
   * The payment mode is written as the bill's one tender, in the same transaction as the bill.
   */
  insertBill(newBill: NewBill): Bill {
    const billRow = this.databaseHandle
      .insert(bill)
      .values({
        ...this.base(),
        deviceId: this.ctx.deviceId,
        counterCode: newBill.seriesCode,
        billNo: newBill.number,
        financialYear: newBill.financialYear,
        numberSeriesId: newBill.numberSeriesId,
        seq: newBill.seq,
        billedAt: newBill.billedAt,
        businessDate: newBill.businessDate,
        customerName: newBill.customerName,
        clientBillId: newBill.clientBillId,
        subtotalPaise: newBill.linesTotalPaise,
        billDiscountPaise: newBill.billDiscountPaise,
        totalPaise: newBill.grandTotalPaise,
        status: "posted",
      })
      .returning()
      .get();
    this.databaseHandle
      .insert(billTender)
      .values({
        ...this.base(),
        billId: billRow.id,
        mode: newBill.paymentMode,
        amountPaise: billRow.totalPaise,
        status: "label",
      })
      .run();
    return toBill(billRow, newBill.paymentMode);
  }

  insertLines(billId: string, lines: NewLine[]): BillLine[] {
    return lines.map((newLine) =>
      toLine(
        this.databaseHandle
          .insert(billLine)
          .values({
            ...this.base(),
            billId,
            lineNo: newLine.lineNo,
            variantId: newLine.itemId,
            itemNameSnapshot: newLine.itemNameSnapshot,
            unitSnapshot: newLine.unitSnapshot,
            qtyBaseMilli: newLine.quantityMilli,
            unitPricePaise: newLine.ratePaise,
            lineDiscountPaise: newLine.lineDiscountPaise,
            amountPaise: newLine.amountPaise,
          })
          .returning()
          .get(),
      ),
    );
  }

  /** The bill already saved for this idempotency key, if any (so a retried save returns the first bill). */
  findByClientBillId(clientBillId: string): { bill: Bill; lines: BillLine[] } | null {
    const existingRow = this.databaseHandle
      .select({ id: bill.id })
      .from(bill)
      .where(and(eq(bill.shopId, this.ctx.shopId), eq(bill.clientBillId, clientBillId)))
      .get();
    return existingRow ? this.get(existingRow.id) : null;
  }

  private tenderMode(billId: string): PaymentMode {
    const tenderRow = this.databaseHandle
      .select({ mode: billTender.mode })
      .from(billTender)
      .where(eq(billTender.billId, billId))
      .get();
    if (!tenderRow) throw new CoreError("INTERNAL", "This bill has no payment record");
    return tenderRow.mode as PaymentMode;
  }

  get(id: string): { bill: Bill; lines: BillLine[] } | null {
    const billRow = this.databaseHandle.select().from(bill).where(eq(bill.id, id)).get();
    if (!billRow) return null;
    const lines = this.databaseHandle
      .select()
      .from(billLine)
      .where(eq(billLine.billId, id))
      .orderBy(asc(billLine.lineNo))
      .all();
    return { bill: toBill(billRow, this.tenderMode(id)), lines: lines.map(toLine) };
  }

  // ----- draft (crash recovery; not a financial record) -----
  saveDraft(payload: unknown): void {
    this.databaseHandle.delete(draftBill).run();
    this.databaseHandle
      .insert(draftBill)
      .values({ ...this.base(), payload: JSON.stringify(payload) })
      .run();
  }

  loadDraft(): unknown | null {
    const draftRow = this.databaseHandle.select().from(draftBill).get();
    return draftRow ? (JSON.parse(draftRow.payload) as unknown) : null;
  }

  clearDraft(): void {
    this.databaseHandle.delete(draftBill).run();
  }
}
