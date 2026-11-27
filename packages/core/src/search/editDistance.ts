/** Whether the last two letters read so far are the other two swapped (a Damerau transposition). */
function isSwap(
  leftLetters: string[],
  rightLetters: string[],
  row: number,
  column: number,
): boolean {
  if (row < 2 || column < 2) return false;
  return (
    leftLetters[row - 1] === rightLetters[column - 2] &&
    leftLetters[row - 2] === rightLetters[column - 1]
  );
}

/** One row of the distance table, from the row before it and the one before that. */
function buildRow(
  letters: { left: string[]; right: string[] },
  row: number,
  previous: number[],
  beforePrevious: number[],
): number[] {
  const current = [row];
  for (let column = 1; column <= letters.right.length; column += 1) {
    const substitutionCost = letters.left[row - 1] === letters.right[column - 1] ? 0 : 1;
    const plainEdit = Math.min(
      previous[column]! + 1,
      current[column - 1]! + 1,
      previous[column - 1]! + substitutionCost,
    );
    const swapEdit = isSwap(letters.left, letters.right, row, column)
      ? beforePrevious[column - 2]! + 1
      : plainEdit;
    current.push(Math.min(plainEdit, swapEdit));
  }
  return current;
}

/**
 * The Damerau-Levenshtein distance between two texts (the restricted form: a swap of two
 * neighbouring letters counts as one edit, and no letter is edited twice). Letters are compared
 * one Unicode character at a time. Example: "elbow" and "elbwo" are 1 apart, "paipa" and "pipe" 2.
 *
 * It returns the distance when it is at most `limit`, and `null` when it is more. It gives up as
 * soon as no alignment can stay within the limit, so a search over many names stays cheap.
 */
export function editDistanceWithin(left: string, right: string, limit: number): number | null {
  const letters = { left: Array.from(left), right: Array.from(right) };
  if (Math.abs(letters.left.length - letters.right.length) > limit) return null;

  let beforePrevious: number[] = [];
  let previous = [...Array(letters.right.length + 1).keys()];
  let previousRowBest = 0;
  for (let row = 1; row <= letters.left.length; row += 1) {
    const current = buildRow(letters, row, previous, beforePrevious);
    const currentRowBest = Math.min(...current);
    if (Math.min(currentRowBest, previousRowBest) > limit) return null;
    previousRowBest = currentRowBest;
    beforePrevious = previous;
    previous = current;
  }
  const distance = previous[letters.right.length]!;
  return distance <= limit ? distance : null;
}

/** The full distance, with no limit. */
export function editDistance(left: string, right: string): number {
  const longest = Math.max(Array.from(left).length, Array.from(right).length);
  return editDistanceWithin(left, right, longest)!;
}
