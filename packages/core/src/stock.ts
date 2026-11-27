import { CoreError } from "./errors";

/** A stored movement: a positive quantity, and the direction told by which location is set. */
export interface IMovementLocations {
  qtyBaseMilli: number;
  fromLocationId: string | null;
  toLocationId: string | null;
}

/** Signed stock change -> the stored form: stock in has only `to`, stock out only `from`. */
export function movementLocations(quantityMilli: number, locationId: string): IMovementLocations {
  if (!Number.isSafeInteger(quantityMilli) || quantityMilli === 0) {
    throw new CoreError("INVALID_QUANTITY", "a stock movement must be a non-zero whole number");
  }
  const isStockIn = quantityMilli > 0;
  return {
    qtyBaseMilli: Math.abs(quantityMilli),
    fromLocationId: isStockIn ? null : locationId,
    toLocationId: isStockIn ? locationId : null,
  };
}

/** The stored form -> the signed stock change (plus for stock in, minus for stock out). */
export function signedQuantityMilli(movement: IMovementLocations): number {
  if (!Number.isSafeInteger(movement.qtyBaseMilli) || movement.qtyBaseMilli <= 0) {
    throw new CoreError("INVALID_QUANTITY", "a stored movement quantity must be above zero");
  }
  const hasFrom = movement.fromLocationId !== null;
  const hasTo = movement.toLocationId !== null;
  if (hasFrom === hasTo) {
    throw new CoreError(
      "INVALID_FIELD",
      "a movement needs exactly one of from and to (transfers come with feature 007)",
    );
  }
  return hasTo ? movement.qtyBaseMilli : -movement.qtyBaseMilli;
}

/** One half of a merge: the stored movement plus which merge type it is. */
export interface IMergeMovement extends IMovementLocations {
  reason: "merge_in" | "merge_out";
}

/**
 * The two movements that move one location's balance from a merged-away variant (the source) to the
 * one that is kept (the target), so merging never changes total stock. A positive balance goes out of
 * the source (`merge_out`) and into the target (`merge_in`); negative stock goes the other way round,
 * so the source ends at zero either way. Example: the source has 4, the target 10: out 4, in 4, and
 * the target has 14. A balance of zero needs no movement.
 */
export function mergeMovementPair(
  sourceBalanceMilli: number,
  locationId: string,
): { source: IMergeMovement; target: IMergeMovement } {
  const toMergeMovement = (signedMilli: number): IMergeMovement => ({
    reason: signedMilli > 0 ? "merge_in" : "merge_out",
    ...movementLocations(signedMilli, locationId),
  });
  return {
    source: toMergeMovement(-sourceBalanceMilli),
    target: toMergeMovement(sourceBalanceMilli),
  };
}

export interface MovementLike {
  itemId: string;
  quantityMilli: number;
}

export function foldMovements(movements: Iterable<MovementLike>): Map<string, number> {
  const out = new Map<string, number>();
  for (const movement of movements)
    out.set(movement.itemId, (out.get(movement.itemId) ?? 0) + movement.quantityMilli);
  return out;
}

export function isNegative(stockMilli: number): boolean {
  return stockMilli < 0;
}

export interface InvariantBreak {
  itemId: string;
  cached: number;
  derived: number;
}

/** Cached item stock must equal the sum of that item's movements. Returns the mismatches. */
export function checkInvariant(
  cached: Map<string, number>,
  movements: Iterable<MovementLike>,
): InvariantBreak[] {
  const derived = foldMovements(movements);
  const ids = new Set([...cached.keys(), ...derived.keys()]);
  const breaks: InvariantBreak[] = [];
  for (const itemId of ids) {
    const cachedMilli = cached.get(itemId) ?? 0;
    const derivedMilli = derived.get(itemId) ?? 0;
    if (cachedMilli !== derivedMilli)
      breaks.push({ itemId, cached: cachedMilli, derived: derivedMilli });
  }
  return breaks;
}
