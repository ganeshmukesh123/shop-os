import type { KeyboardEvent } from "react";

const STEP_BY_KEY: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * Arrow keys move focus to the next stocked cell in that direction (research D15); Enter and
 * Space press the focused cell's button as usual. Cells carry data-row and data-column.
 */
export function moveFocusInGrid(keyboardEvent: KeyboardEvent<HTMLElement>): void {
  const step = STEP_BY_KEY[keyboardEvent.key];
  const focused = (keyboardEvent.target as HTMLElement).closest<HTMLElement>("[data-row]");
  if (!step || !focused) return;
  keyboardEvent.preventDefault();
  let row = Number(focused.dataset.row);
  let column = Number(focused.dataset.column);
  const container = keyboardEvent.currentTarget;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    row += step[0];
    column += step[1];
    const next = container.querySelector<HTMLElement>(
      `[data-row="${row}"][data-column="${column}"]`,
    );
    if (next) {
      next.focus();
      return;
    }
    if (row < 0 || column < 0) return;
  }
}
