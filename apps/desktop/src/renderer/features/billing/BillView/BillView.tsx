import { useState } from "react";
import { Button, Flex, Heading, Select, Table, Text } from "@radix-ui/themes";
import { LAYOUT } from "../../../shared/constants/layout";
import { StatusBadge } from "../../../shared/components/StatusBadge/StatusBadge";
import { StatusMessage } from "../../../shared/components/StatusMessage/StatusMessage";
import {
  formatQuantity,
  formatRupees,
  type Bill,
  type BillLine,
  type Item,
  type PrintTarget,
} from "@shopos/core";
import { useToast } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { ApiError, call, messageOf } from "../../../shared/api/api";
import { RoundOffLine } from "../RoundOffLine/RoundOffLine";
import { CancelledBanner } from "./components/CancelledBanner";

/**
 * The saved bill, with Print / Save PDF and "New bill". Printing happens after the bill is committed.
 * Opened from the Bills screen (`onBack`), the last button goes back to the list instead.
 */
export function BillView({
  bill,
  lines,
  negativeStockItems,
  onNew,
  onBack,
  onCancel,
}: {
  bill: Bill;
  lines: BillLine[];
  negativeStockItems: Item[];
  onNew?: () => void;
  onBack?: () => void;
  /** Offered as "Cancel bill" while the bill is posted; the Bills screen asks for the reason. */
  onCancel?: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<PrintTarget>("receipt");
  const [busy, setBusy] = useState<"print" | "pdf" | null>(null);

  async function print() {
    setBusy("print");
    try {
      await call("bills.print", { id: bill.id, target });
    } catch (caughtError) {
      toast(
        "error",
        `${messageOf(caughtError)} ${caughtError instanceof ApiError && caughtError.code === "PRINT_FAILED" ? "" : uiText.bill.printFailedHint}`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function pdf() {
    setBusy("pdf");
    try {
      const { path } = await call("system.pickPdfPath", {
        defaultName: `${bill.number.replace(/[/\\]/g, "-")}.pdf`,
      });
      if (!path) return;
      await call("bills.exportPdf", { id: bill.id, target, filePath: path });
      toast("success", `${uiText.bill.pdfSaved}: ${path}`);
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageMedium}>
      <Flex align="center" gap="3">
        <Heading size="6">
          {onBack ? uiText.bill.opened : uiText.bill.saved}: {bill.number}
        </Heading>
        {bill.status === "cancelled" && (
          <StatusBadge role="danger" label={uiText.status.cancelled} size="3" />
        )}
      </Flex>
      <Text color="gray">
        {bill.billDate.replace("T", " ").slice(0, 16)} · {uiText.payment[bill.paymentMode]}
        {bill.customerName ? ` · ${bill.customerName}` : ""}
      </Text>
      {bill.status === "cancelled" && (
        <CancelledBanner cancelReason={bill.cancelReason} cancelledAt={bill.cancelledAt} />
      )}
      {negativeStockItems.length > 0 && (
        <StatusMessage role="warning" label={uiText.status.negativeStock}>
          {uiText.bill.negativeWarn}{" "}
          {negativeStockItems
            .map((item) => `${item.name} (${formatQuantity(item.stockMilli)} ${item.unit})`)
            .join(", ")}
          . Correct stock from the Items screen.
        </StatusMessage>
      )}
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
      <Flex direction="column" align="end" gap="1">
        <Text>
          {uiText.bill.total}: {formatRupees(bill.linesTotalPaise)}
        </Text>
        {bill.billDiscountPaise > 0 && (
          <Text>
            {uiText.bill.billDiscount}: -{formatRupees(bill.billDiscountPaise)}
          </Text>
        )}
        <RoundOffLine roundOffPaise={bill.roundOffPaise} />
        <Text size="6" weight="bold">
          {uiText.bill.grandTotal}: {formatRupees(bill.grandTotalPaise)}
        </Text>
      </Flex>
      <Flex gap="3" align="center" wrap="wrap">
        <Text size="2" weight="bold" id="print-as">
          {uiText.bill.printTo}
        </Text>
        <Select.Root
          value={target}
          onValueChange={(selectedTarget) => setTarget(selectedTarget as PrintTarget)}
        >
          <Select.Trigger aria-labelledby="print-as" />
          <Select.Content>
            <Select.Item value="receipt">{uiText.bill.receipt}</Select.Item>
            <Select.Item value="a5">A5</Select.Item>
            <Select.Item value="a4">A4</Select.Item>
          </Select.Content>
        </Select.Root>
        <Button size="3" onClick={() => void print()} loading={busy === "print"} autoFocus>
          {uiText.bill.print}
        </Button>
        <Button size="3" variant="soft" onClick={() => void pdf()} loading={busy === "pdf"}>
          {uiText.bill.pdf}
        </Button>
        <Button size="3" variant="outline" onClick={onBack ?? onNew}>
          {onBack ? uiText.bills.back : uiText.bill.newBill}
        </Button>
        {onCancel && bill.status === "posted" && (
          <Button size="3" variant="soft" color="red" onClick={onCancel}>
            {uiText.bills.cancel.open}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
