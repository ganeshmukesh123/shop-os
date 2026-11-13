import {
  CoreError,
  assertQuantity,
  defaultAllowsDecimal,
  itemsCreateInput,
  itemsUpdateInput,
  stockAdjustInput,
  type Item,
  type ItemsCreateInput,
  type ItemsListInput,
  type ItemsUpdateInput,
  type StockAdjustInput,
  type StockMovement,
} from "@shopos/core";
import type { DB } from "../db/connection";
import type { Ctx } from "../db/seed";
import { ItemRepository } from "../repositories/ItemRepository";
import { StockRepository } from "../repositories/StockRepository";

export class InventoryService {
  constructor(
    private readonly db: DB,
    private readonly ctx: Ctx,
  ) {}

  createItem(raw: ItemsCreateInput): { item: Item } {
    const input = itemsCreateInput.parse(raw);
    const allowsDecimal = input.allowsDecimal ?? defaultAllowsDecimal(input.unit);
    assertQuantity(input.openingQtyMilli, allowsDecimal);
    return this.db.transaction((tx) => {
      const items = new ItemRepository(tx, this.ctx);
      const stock = new StockRepository(tx, this.ctx);
      const dupes = items.findActiveByName(input.name);
      if (dupes.length)
        throw new CoreError("DUPLICATE_NAME", "An item with this name already exists", dupes);
      const created = items.create({
        name: input.name,
        unit: input.unit,
        allowsDecimal,
        pricePaise: input.pricePaise,
      });
      if (input.openingQtyMilli !== 0) {
        stock.append({
          itemId: created.id,
          quantityMilli: input.openingQtyMilli,
          reason: "opening",
        });
        items.addStockDelta(created.id, input.openingQtyMilli);
      }
      return { item: items.get(created.id)! };
    });
  }

  updateItem(raw: ItemsUpdateInput): { item: Item } {
    const input = itemsUpdateInput.parse(raw);
    return this.db.transaction((tx) => {
      const items = new ItemRepository(tx, this.ctx);
      const current = items.get(input.id);
      if (!current) throw new CoreError("NOT_FOUND", "Item not found");
      const willBeActive = input.active ?? current.active;
      if (willBeActive && (input.name !== undefined || input.active === true)) {
        const name = input.name ?? current.name;
        const dupes = items.findActiveByName(name, current.id);
        if (dupes.length)
          throw new CoreError("DUPLICATE_NAME", "An item with this name already exists", dupes);
      }
      const patch: Parameters<ItemRepository["update"]>[1] = { ...input };
      delete (patch as { id?: string }).id;
      if (
        input.unit !== undefined &&
        input.unit !== current.unit &&
        current.stockMilli % 1000 === 0
      ) {
        patch.allowsDecimal = defaultAllowsDecimal(input.unit);
      }
      const updated = items.update(input.id, patch)!;
      return { item: updated };
    });
  }

  adjustStock(raw: StockAdjustInput): { item: Item; movement: StockMovement | null } {
    const input = stockAdjustInput.parse(raw);
    if (input.note.trim().length === 0)
      throw new CoreError("NOTE_REQUIRED", "A note is required for a stock adjustment");
    return this.db.transaction((tx) => {
      const items = new ItemRepository(tx, this.ctx);
      const stock = new StockRepository(tx, this.ctx);
      const current = items.get(input.itemId);
      if (!current) throw new CoreError("NOT_FOUND", "Item not found");
      assertQuantity(input.quantityMilli, current.allowsDecimal);
      if (input.mode === "set" && input.quantityMilli < 0)
        throw new CoreError("INVALID_QUANTITY", "Stock cannot be set below zero");
      const delta =
        input.mode === "add" ? input.quantityMilli : input.quantityMilli - current.stockMilli;
      if (delta === 0) return { item: current, movement: null };
      const movement = stock.append({
        itemId: current.id,
        quantityMilli: delta,
        reason: "adjustment",
        note: input.note.trim(),
      });
      items.addStockDelta(current.id, delta);
      return { item: items.get(current.id)!, movement };
    });
  }

  listItems(listInput: ItemsListInput): { items: Item[]; total: number } {
    return new ItemRepository(this.db, this.ctx).list(listInput);
  }
}
