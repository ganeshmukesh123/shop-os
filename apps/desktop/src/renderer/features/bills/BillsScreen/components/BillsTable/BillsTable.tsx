import { Button, Table, Text } from "@radix-ui/themes";
import { formatRupees } from "@shopos/core";
import { StatusBadge } from "../../../../../shared/components/StatusBadge/StatusBadge";
import { uiText } from "../../../../../shared/text/strings";
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
          <Table.Row key={bill.id}>
            <Table.RowHeaderCell>
              <Button size="2" variant="ghost" onClick={() => onOpen(bill.id)}>
                {bill.number}
              </Button>
            </Table.RowHeaderCell>
            <Table.Cell>{bill.billDate.replace("T", " ").slice(0, 16)}</Table.Cell>
            <Table.Cell>{bill.customerName ?? ""}</Table.Cell>
            <Table.Cell>{uiText.payment[bill.paymentMode]}</Table.Cell>
            <Table.Cell justify="end">{formatRupees(bill.grandTotalPaise)}</Table.Cell>
            <Table.Cell>
              {bill.status === "cancelled" ? (
                <StatusBadge role="danger" label={uiText.status.cancelled} />
              ) : (
                <Text color="gray">{uiText.bills.posted}</Text>
              )}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
