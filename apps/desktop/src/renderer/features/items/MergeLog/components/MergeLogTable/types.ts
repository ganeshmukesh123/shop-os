import type { IMergeListRow } from "@shopos/core";
import type { useReverseMerge } from "../../hooks/useReverseMerge";

export interface IMergeLogTableProps {
  merges: readonly IMergeListRow[];
  reversal: ReturnType<typeof useReverseMerge>;
}
