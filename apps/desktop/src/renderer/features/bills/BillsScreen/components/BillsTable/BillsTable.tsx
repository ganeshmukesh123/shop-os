import { Table } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { BillRow } from "../BillRow";
import { LostInRestoreRow } from "../LostInRestoreRow";
import type { IBillsTableProps } from "./types";

/**
 * One row per bill, newest first; the number opens the bill. A cancelled bill says "Cancelled" in
 * words, not only in colour.
 */
export function BillsTable({ bills, gaps, onOpen }: IBillsTableProps) {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{uiText.bills.number}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bills.date}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bills.customer}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bills.payment}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">{uiText.bills.total}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{uiText.bills.status}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {gaps.map((gap) => (
          <LostInRestoreRow key={gap.id} gap={gap} />
        ))}
        {bills.map((bill) => (
          <BillRow key={bill.id} bill={bill} onOpen={onOpen} />
        ))}
      </Table.Body>
    </Table.Root>
  );
}
