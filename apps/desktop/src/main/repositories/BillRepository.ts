import { and, asc, eq, sql } from "drizzle-orm";
import type { Bill, BillLine, PaymentMode } from "@shopos/core";
import type { Handle } from "../db/connection";
import { newId, nowIso } from "../db/ids";
import { bill, billLine, draftBill, numberCounter } from "../db/schema";
import type { Ctx } from "../db/seed";

const toBill = (billRow: typeof bill.$inferSelect): Bill => ({
  id: billRow.id,
  number: billRow.billNo,
  seriesCode: billRow.counterCode,
  seq: billRow.seq,
  billDate: billRow.billDate,
  customerName: billRow.customerName,
  paymentMode: billRow.paymentMode as PaymentMode,
  linesTotalPaise: billRow.subtotalPaise,
  billDiscountPaise: billRow.billDiscountPaise,
  grandTotalPaise: billRow.totalPaise,
  status: billRow.status as Bill["status"],
  cancelReason: billRow.cancelReason,
  cancelledAt: billRow.cancelledAt,
});

const toLine = (lineRow: typeof billLine.$inferSelect): BillLine => ({
  id: lineRow.id,
  billId: lineRow.billId,
  lineNo: lineRow.lineNo,
  itemId: lineRow.itemId,
  itemNameSnapshot: lineRow.itemNameSnapshot,
  unitSnapshot: lineRow.unitSnapshot,
  quantityMilli: lineRow.quantityMilli,
  ratePaise: lineRow.ratePaise,
  lineDiscountPaise: lineRow.lineDiscountPaise,
  amountPaise: lineRow.amountPaise,
});

export interface NewBill {
  number: string;
  seriesCode: string;
  financialYear: string;
  seq: number;
  billDate: string;
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
    const now = nowIso();
    return {
      id: newId(),
      businessId: this.ctx.businessId,
      shopId: this.ctx.shopId,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Increment and return the next sequence. Must run inside the bill-save transaction. */
  nextSeq(seriesCode: string, financialYear: string): number {
    const now = nowIso();
    const row = this.databaseHandle
      .insert(numberCounter)
      .values({ ...this.base(), seriesCode, financialYear, lastSeq: 1 })
      .onConflictDoUpdate({
        target: [numberCounter.seriesCode, numberCounter.financialYear],
        set: { lastSeq: sql`${numberCounter.lastSeq} + 1`, updatedAt: now },
      })
      .returning({ seq: numberCounter.lastSeq })
      .get();
    return row.seq;
  }

  /** The domain names (number, seriesCode, ...) are stored as bill_no, counter_code, ... (D18). */
  insertBill(newBill: NewBill): Bill {
    return toBill(
      this.databaseHandle
        .insert(bill)
        .values({
          ...this.base(),
          deviceId: this.ctx.deviceId,
          counterCode: newBill.seriesCode,
          billNo: newBill.number,
          financialYear: newBill.financialYear,
          seq: newBill.seq,
          billDate: newBill.billDate,
          customerName: newBill.customerName,
          clientBillId: newBill.clientBillId,
          paymentMode: newBill.paymentMode,
          subtotalPaise: newBill.linesTotalPaise,
          billDiscountPaise: newBill.billDiscountPaise,
          totalPaise: newBill.grandTotalPaise,
          status: "posted",
        })
        .returning()
        .get(),
    );
  }

  insertLines(billId: string, lines: NewLine[]): BillLine[] {
    return lines.map((newLine) =>
      toLine(
        this.databaseHandle
          .insert(billLine)
          .values({ ...this.base(), billId, ...newLine })
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

  get(id: string): { bill: Bill; lines: BillLine[] } | null {
    const billRow = this.databaseHandle.select().from(bill).where(eq(bill.id, id)).get();
    if (!billRow) return null;
    const lines = this.databaseHandle
      .select()
      .from(billLine)
      .where(eq(billLine.billId, id))
      .orderBy(asc(billLine.lineNo))
      .all();
    return { bill: toBill(billRow), lines: lines.map(toLine) };
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
