import { Button, Table, Text } from "@radix-ui/themes";
import { formatRupees } from "@shopos/core";
import { StatusBadge } from "../../../../../shared/components/StatusBadge/StatusBadge";
import { uiText } from "../../../../../shared/text/strings";
import type { IBillRowProps } from "./types";

/** One saved bill; the number opens it, and a cancelled bill says "Cancelled" in words. */
export function BillRow({ bill, onOpen }: IBillRowProps) {
  return (
    <Table.Row>
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
  );
}
