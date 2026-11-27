import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { CoreError } from "@shopos/core";
import type { Bill, BillsListInput, PaymentMode } from "@shopos/core";
import type { Handle } from "../../db/connection";
import { bill, billTender } from "../../db/schema";
import type { Ctx } from "../../db/seed";
import { toBill } from "../BillRepository";

/** The most bills one page may hold, whatever the caller asks for (matches the command's limit). */
export const MAX_BILL_PAGE_SIZE = 500;

/**
 * Make a search term safe for `LIKE ... ESCAPE '\'`: %, _ and the escape itself match literally.
 * ItemRepository has the same three lines; they are shared once the repositories get their folders
 * (task T093 open item).
 */
const escapeLike = (rawText: string): string =>
  rawText.replace(/[\\%_]/g, (specialCharacter) => `\\${specialCharacter}`);

/** Reads saved bills for the bill list. It never writes: saved bills are insert-only. */
export class BillSearchRepository {
  constructor(
    private readonly databaseHandle: Handle,
    private readonly ctx: Ctx,
  ) {}

  /** The conditions for a bill search: this shop's bills that match every filter that was given. */
  private conditions(filter: BillsListInput): SQL[] {
    const containing = (searchText: string) => `%${escapeLike(searchText.trim())}%`;
    const conditions: SQL[] = [eq(bill.shopId, this.ctx.shopId)];
    if (filter.number?.trim()) {
      conditions.push(
        sql`${bill.billNo} LIKE ${containing(filter.number)} ESCAPE '\\' COLLATE NOCASE`,
      );
    }
    if (filter.customer?.trim()) {
      conditions.push(
        sql`${bill.customerName} LIKE ${containing(filter.customer)} ESCAPE '\\' COLLATE NOCASE`,
      );
    }
    if (filter.from) conditions.push(gte(bill.businessDate, filter.from));
    if (filter.to) conditions.push(lte(bill.businessDate, filter.to));
    if (filter.status) conditions.push(eq(bill.status, filter.status));
    return conditions;
  }

  /** The payment mode of each bill in one query (the tender holds it, not the bill row). */
  private tenderModes(billIds: string[]): Map<string, PaymentMode> {
    if (billIds.length === 0) return new Map();
    const tenderRows = this.databaseHandle
      .select({ billId: billTender.billId, mode: billTender.mode })
      .from(billTender)
      .where(inArray(billTender.billId, billIds))
      .all();
    return new Map(
      tenderRows.map((tenderRow) => [tenderRow.billId, tenderRow.mode as PaymentMode]),
    );
  }

  /**
   * Search the saved bills, newest first, one page at a time (FR-016). `total` counts every match,
   * not just this page. A search term is plain text: %, _ and \ match themselves.
   */
  list(filter: BillsListInput): { bills: Bill[]; total: number } {
    const isInvalidLimit = Number.isInteger(filter.limit) === false || filter.limit <= 0;
    if (isInvalidLimit) {
      throw new CoreError("INVALID_FIELD", "Bill page limit must be a positive integer");
    }
    const where = and(...this.conditions(filter));
    const total =
      this.databaseHandle
        .select({ matchingCount: sql<number>`count(*)` })
        .from(bill)
        .where(where)
        .get()?.matchingCount ?? 0;
    const billRows = this.databaseHandle
      .select()
      .from(bill)
      .where(where)
      .orderBy(desc(bill.billedAt), desc(bill.createdAt), desc(bill.id))
      .limit(Math.min(filter.limit, MAX_BILL_PAGE_SIZE))
      .offset(filter.offset)
      .all();
    const modes = this.tenderModes(billRows.map((billRow) => billRow.id));
    const bills = billRows.map((billRow) => {
      const paymentMode = modes.get(billRow.id);
      if (!paymentMode) throw new CoreError("INTERNAL", "This bill has no payment record");
      return toBill(billRow, paymentMode);
    });
    return { bills, total };
  }
}
