import type { IMergeMove } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { ItemRepository } from "../../repositories/ItemRepository";
import { MergeRepository } from "../../repositories/MergeRepository";

/**
 * Move logged balances from the first variant to the second, on the document `docId`, and keep
 * both cached stocks equal to their movements. A positive balance goes first to second; a negative
 * one is moved the other way round (research D6 step 3). A reversal passes the pair swapped.
 */
export function moveLoggedStock(
  handle: Handle,
  ctx: Ctx,
  logged: { moves: readonly IMergeMove[]; docId: string },
  [fromId, toId]: readonly [string, string],
): void {
  const merges = new MergeRepository(handle, ctx);
  logged.moves.forEach((balance) =>
    balance.qtyMilli > 0
      ? merges.moveStock(fromId, toId, balance, logged.docId)
      : merges.moveStock(toId, fromId, { ...balance, qtyMilli: -balance.qtyMilli }, logged.docId),
  );
  const movedMilli = logged.moves.reduce((total, balance) => total + balance.qtyMilli, 0);
  const items = new ItemRepository(handle, ctx);
  items.addStockDelta(toId, movedMilli);
  items.addStockDelta(fromId, -movedMilli);
}
