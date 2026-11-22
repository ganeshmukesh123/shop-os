import { Table, Text } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { BillLineRow } from "../../../BillLineRow";
import type { IBillLinesTableProps } from "./types";

/** The lines of the bill so far, or a hint to search for the first item. */
export function BillLinesTable({
  lines,
  results,
  onLineChange,
  onLineRemove,
  onEnterQty,
  onQtyFieldRef,
}: IBillLinesTableProps) {
  if (lines.length === 0) return <Text color="gray">{uiText.bill.empty}</Text>;
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{uiText.bill.item}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bill.qty}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bill.rate}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bill.discount}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">{uiText.bill.amount}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {lines.map((draftLine, listIndex) => (
          <BillLineRow
            key={draftLine.key}
            line={draftLine}
            result={results[listIndex]!}
            ref={(quantityField) => onQtyFieldRef(draftLine.key, quantityField)}
            onChange={(linePatch) => onLineChange(draftLine.key, linePatch)}
            onRemove={() => onLineRemove(draftLine.key)}
            onEnterQty={onEnterQty}
          />
        ))}
      </Table.Body>
    </Table.Root>
  );
}
