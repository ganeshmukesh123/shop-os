import {
  CoreError,
  assertQuantity,
  billsCancelInput,
  billsSaveInput,
  businessDateOf,
  computeBill,
  financialYearOfBusinessDate,
  formatBillNumber,
  roundBillTotal,
  type Bill,
  type BillLine,
  type BillsCancelInput,
  type BillsListInput,
  type BillsSaveInput,
  type IRecordedNumberGap,
  type Item,
} from "@shopos/core";
import type { DB } from "../db/connection";
import type { Ctx } from "../db/seed";
import { BillCancelRepository } from "../repositories/BillCancelRepository";
import { BillRepository } from "../repositories/BillRepository";
import { BillSearchRepository } from "../repositories/BillSearchRepository";
import { ItemRepository } from "../repositories/ItemRepository";
import { NumberGapRepository } from "../repositories/NumberGapRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { StockRepository } from "../repositories/StockRepository";

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

      // Idempotent save: a retry, double-click or crash-and-retry with the same id returns the
      // first bill and changes nothing (no second bill, no second stock movement).
      const alreadySaved = bills.findByClientBillId(input.clientBillId);
      if (alreadySaved) {
        return {
          ...alreadySaved,
          negativeStockItems: this.itemsWithNegativeStock(
            items,
            alreadySaved.lines.map((savedLine) => savedLine.itemId),
          ),
        };
      }

      const resolved = input.lines.map((lineInput) => {
        const catalogItem = items.get(lineInput.itemId);
        if (!catalogItem) throw new CoreError("NOT_FOUND", "Item not found on the bill");
        if (!catalogItem.active)
          throw new CoreError("ITEM_INACTIVE", `${catalogItem.name} is inactive`);
        assertQuantity(lineInput.quantityMilli, catalogItem.allowsDecimal);
        return catalogItem;
      });

      // The bill's date and financial year come from the shop's zone, never the device's (FR-019a).
      const billedAt = now.getTime();
      const businessDate = businessDateOf(billedAt, profile.timeZone);
      const billFinancialYear = financialYearOfBusinessDate(businessDate);
      const { seq, numberSeriesId } = bills.nextSeq(
        profile.seriesCode,
        billFinancialYear,
        profile.numberTemplate,
      );
      const number = formatBillNumber(
        profile.numberTemplate,
        profile.seriesCode,
        billFinancialYear,
        seq,
      );

      // Lines keep exact paise; only the grand total is rounded, and the difference is kept apart (FR-010a).
      const rounded = roundBillTotal(totals.grandTotalPaise, profile.roundBillTotal);

      const saved = bills.insertBill({
        number,
        seriesCode: profile.seriesCode,
        financialYear: billFinancialYear,
        numberSeriesId,
        seq,
        billedAt,
        businessDate,
        customerName: input.customerName?.trim() || null,
        clientBillId: input.clientBillId,
        docTitle: profile.docTitle,
        timeZone: profile.timeZone,
        paymentMode: input.paymentMode,
        linesTotalPaise: totals.linesTotalPaise,
        billDiscountPaise: totals.billDiscountPaise,
        roundOffPaise: rounded.roundOffPaise,
        grandTotalPaise: rounded.roundedTotalPaise,
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

      const negativeStockItems = this.itemsWithNegativeStock(
        items,
        input.lines.map((lineInput) => lineInput.itemId),
      );
      return { bill: saved, lines, negativeStockItems };
    });
  }

  private itemsWithNegativeStock(items: ItemRepository, itemIds: string[]): Item[] {
    return [...new Set(itemIds)]
      .map((itemId) => items.get(itemId)!)
      .filter((item) => item.stockMilli < 0);
  }

  /**
   * Cancel a posted bill (FR-017) in ONE transaction: mark it Cancelled with the reason, then append
   * one equal and opposite `sale_cancel` movement per line and give the stock back. The bill, its
   * lines and the original `sale` movements are never changed, and its number is never reused.
   */
  cancelBill(raw: BillsCancelInput, now: Date = new Date()): { bill: Bill } {
    const input = billsCancelInput.parse(raw);
    const reason = input.reason.trim();
    if (!reason) throw new CoreError("REASON_REQUIRED", "Say why the bill is being cancelled");

    return this.db.transaction((tx) => {
      const bills = new BillRepository(tx, this.ctx);
      const savedBill = bills.get(input.id);
      if (!savedBill) throw new CoreError("NOT_FOUND", "Bill not found");
      const wasPosted = new BillCancelRepository(tx, this.ctx).markCancelled(
        input.id,
        reason,
        now.getTime(),
      );
      if (!wasPosted) throw new CoreError("ALREADY_CANCELLED", "This bill is already cancelled");

      const stock = new StockRepository(tx, this.ctx);
      const items = new ItemRepository(tx, this.ctx);
      for (const savedLine of savedBill.lines) {
        stock.append({
          itemId: savedLine.itemId,
          quantityMilli: savedLine.quantityMilli,
          reason: "sale_cancel",
          billId: input.id,
        });
        items.addStockDelta(savedLine.itemId, savedLine.quantityMilli);
      }
      return { bill: bills.get(input.id)!.bill };
    });
  }

  /** Search the saved bills for the bill list (FR-016): newest first, one page at a time. */
  listBills(input: BillsListInput): { bills: Bill[]; total: number } {
    return new BillSearchRepository(this.db, this.ctx).list(input);
  }

  /** The bill numbers a restore lost, for the bill list (FR-013b). */
  listNumberGaps(): IRecordedNumberGap[] {
    return new NumberGapRepository(this.db, this.ctx).list();
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
