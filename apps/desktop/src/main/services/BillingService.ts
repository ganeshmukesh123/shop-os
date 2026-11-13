import {
  CoreError,
  assertQuantity,
  billsSaveInput,
  computeBill,
  financialYear,
  formatBillNumber,
  type Bill,
  type BillLine,
  type BillsSaveInput,
  type Item,
} from "@shopos/core";
import type { DB } from "../db/connection";
import type { Ctx } from "../db/seed";
import { BillRepository } from "../repositories/BillRepository";
import { ItemRepository } from "../repositories/ItemRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { StockRepository } from "../repositories/StockRepository";

const pad = (numberValue: number) => String(numberValue).padStart(2, "0");
/** Local timestamp without zone, e.g. 2026-12-07T14:05:09 (data-model: bill_date is local). */
export const localIso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

export class BillingService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  /**
   * Validate, then in ONE transaction: take the next number, insert the bill and lines, append one
   * `sale` movement per line, update cached stock and clear the draft. Returns before any printing.
   */
  saveBill(
    raw: BillsSaveInput,
    now: Date = new Date(),
  ): { bill: Bill; lines: BillLine[]; negativeStockItems: Item[] } {
    const input = billsSaveInput.parse(raw);
    if (input.lines.length === 0)
      throw new CoreError("EMPTY_BILL", "A bill needs at least one line");
    const totals = computeBill({ lines: input.lines, billDiscountPaise: input.billDiscountPaise });

    return this.db.transaction((tx) => {
      const items = new ItemRepository(tx, this.ctx);
      const stock = new StockRepository(tx, this.ctx);
      const bills = new BillRepository(tx, this.ctx);
      const profile = new SettingsRepository(tx, this.ctx).get();

      const resolved = input.lines.map((lineInput) => {
        const it = items.get(lineInput.itemId);
        if (!it) throw new CoreError("NOT_FOUND", "Item not found on the bill");
        if (!it.active) throw new CoreError("ITEM_INACTIVE", `${it.name} is inactive`);
        assertQuantity(lineInput.quantityMilli, it.allowsDecimal);
        return it;
      });

      const fy = financialYear(now);
      const seq = bills.nextSeq(profile.seriesCode, fy);
      const number = formatBillNumber(profile.numberTemplate, profile.seriesCode, fy, seq);

      const saved = bills.insertBill({
        number,
        seriesCode: profile.seriesCode,
        financialYear: fy,
        seq,
        billDate: localIso(now),
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        paymentMode: input.paymentMode,
        linesTotalPaise: totals.linesTotalPaise,
        billDiscountPaise: totals.billDiscountPaise,
        grandTotalPaise: totals.grandTotalPaise,
      });
      const lines = bills.insertLines(
        saved.id,
        input.lines.map((lineInput, lineIndex) => ({
          lineNo: lineIndex + 1,
          itemId: lineInput.itemId,
          itemNameSnapshot: resolved[lineIndex]!.name,
          unitSnapshot: resolved[lineIndex]!.unit,
          quantityMilli: lineInput.quantityMilli,
          ratePaise: lineInput.ratePaise,
          lineDiscountPaise: lineInput.lineDiscountPaise,
          amountPaise: totals.lineAmounts[lineIndex]!,
        })),
      );
      for (const lineInput of input.lines) {
        stock.append({
          itemId: lineInput.itemId,
          quantityMilli: -lineInput.quantityMilli,
          reason: "sale",
          billId: saved.id,
        });
        items.addStockDelta(lineInput.itemId, -lineInput.quantityMilli);
      }
      bills.clearDraft();

      const negativeStockItems = [...new Set(input.lines.map((lineInput) => lineInput.itemId))]
        .map((id) => items.get(id)!)
        .filter((item) => item.stockMilli < 0);
      return { bill: saved, lines, negativeStockItems };
    });
  }

  getBill(id: string): { bill: Bill; lines: BillLine[] } {
    const billWithLines = new BillRepository(this.db, this.ctx).get(id);
    if (!billWithLines) throw new CoreError("NOT_FOUND", "Bill not found");
    return billWithLines;
  }

  saveDraft(payload: unknown): void {
    new BillRepository(this.db, this.ctx).saveDraft(payload);
  }

  loadDraft(): unknown | null {
    return new BillRepository(this.db, this.ctx).loadDraft();
  }
}
