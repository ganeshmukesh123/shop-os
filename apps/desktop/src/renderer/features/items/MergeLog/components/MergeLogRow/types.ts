import type { IMergeListRow } from "@shopos/core";

export interface IMergeLogRowProps {
  merge: IMergeListRow;
  nowMs: number;
  /** This row's reason box is open */
  isReversing: boolean;
  reason: string;
  onStartReverse: () => void;
  onReason: (reason: string) => void;
  onConfirm: () => void;
}
