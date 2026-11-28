import { Table } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { MergeLogRow } from "../MergeLogRow";
import type { IMergeLogTableProps } from "./types";

/** The merges, newest first, each with its Reverse cell (spec 002 T051). */
export function MergeLogTable({ merges, reversal }: IMergeLogTableProps) {
  const text = uiText.mergeLog;
  const nowMs = Date.now();
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{text.merge}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.date}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.status}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {merges.map((merge) => (
          <MergeLogRow
            key={merge.id}
            merge={merge}
            nowMs={nowMs}
            isReversing={reversal.reversingId === merge.id}
            reason={reversal.reason}
            onStartReverse={() => reversal.start(merge.id)}
            onReason={reversal.setReason}
            onConfirm={() => void reversal.confirm()}
          />
        ))}
      </Table.Body>
    </Table.Root>
  );
}
