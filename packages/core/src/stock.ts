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
