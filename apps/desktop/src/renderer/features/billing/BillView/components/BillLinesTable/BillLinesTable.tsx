import { Table } from "@radix-ui/themes";
import { formatQuantity, formatRupees } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import type { IBillLinesTableProps } from "./types";

/** One row per saved line: item, quantity with unit, rate, line discount and amount. */
export function BillLinesTable({ lines }: IBillLinesTableProps) {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{uiText.bill.item}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">{uiText.bill.qty}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">{uiText.bill.rate}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">{uiText.bill.discount}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell justify="end">{uiText.bill.amount}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {lines.map((billLine) => (
          <Table.Row key={billLine.id}>
            <Table.RowHeaderCell>{billLine.itemNameSnapshot}</Table.RowHeaderCell>
            <Table.Cell justify="end">
              {formatQuantity(billLine.quantityMilli)} {billLine.unitSnapshot}
            </Table.Cell>
            <Table.Cell justify="end">{formatRupees(billLine.ratePaise)}</Table.Cell>
            <Table.Cell justify="end">
              {billLine.lineDiscountPaise ? formatRupees(billLine.lineDiscountPaise) : ""}
            </Table.Cell>
            <Table.Cell justify="end">{formatRupees(billLine.amountPaise)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
