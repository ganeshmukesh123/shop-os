import { forwardRef } from "react";
import { Box, Button, Flex, SegmentedControl, Table, Text, TextField } from "@radix-ui/themes";
import { formatRupees, type DraftLine, type DraftLineResult } from "@shopos/core";
import { LAYOUT } from "../shared/constants/layout";
import { StatusMessage } from "../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../shared/text/strings";

interface Props {
  line: DraftLine;
  result: DraftLineResult;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
  onEnterQty: () => void;
}

/** One editable bill line. Errors are shown as text under the row, never by colour alone. */
export const BillLineRow = forwardRef<HTMLInputElement, Props>(function BillLineRow(
  { line, result, onChange, onRemove, onEnterQty },
  qtyRef,
) {
  return (
    <>
      <Table.Row align="center">
        <Table.RowHeaderCell>
          {line.name}
          <Text as="div" size="1" color="gray">
            {line.unit}
          </Text>
        </Table.RowHeaderCell>
        <Table.Cell width={LAYOUT.quantityColumnWidth}>
          <TextField.Root
            ref={qtyRef}
            size="3"
            inputMode="decimal"
            aria-label={`${uiText.bill.qty} ${line.name}`}
            value={line.qty}
            onFocus={(focusEvent) => focusEvent.target.select()}
            onChange={(changeEvent) => onChange({ qty: changeEvent.target.value })}
            onKeyDown={(keyboardEvent) => keyboardEvent.key === "Enter" && onEnterQty()}
          />
        </Table.Cell>
        <Table.Cell width={LAYOUT.rateColumnWidth}>
          <TextField.Root
            size="3"
            inputMode="decimal"
            aria-label={`${uiText.bill.rate} ${line.name}`}
            value={line.rate}
            onFocus={(focusEvent) => focusEvent.target.select()}
            onChange={(changeEvent) => onChange({ rate: changeEvent.target.value })}
          />
        </Table.Cell>
        <Table.Cell width={LAYOUT.discountColumnWidth}>
          <Flex gap="2" align="center">
            <Box width={LAYOUT.lineDiscountFieldWidth}>
              <TextField.Root
                size="3"
                inputMode="decimal"
                aria-label={`${uiText.bill.discount} ${line.name}`}
                value={line.disc}
                onChange={(changeEvent) => onChange({ disc: changeEvent.target.value })}
              />
            </Box>
            <SegmentedControl.Root
              size="2"
              value={line.discMode}
              onValueChange={(selectedDiscountMode) =>
                onChange({ discMode: selectedDiscountMode as "rupees" | "percent" })
              }
              aria-label="Discount type"
            >
              <SegmentedControl.Item value="rupees">₹</SegmentedControl.Item>
              <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
        </Table.Cell>
        <Table.Cell justify="end" width={LAYOUT.amountColumnWidth}>
          <Text weight="bold">
            {result.amountPaise === null ? "–" : formatRupees(result.amountPaise)}
          </Text>
        </Table.Cell>
        <Table.Cell width={LAYOUT.actionColumnWidth}>
          <Button
            size="2"
            variant="soft"
            color="gray"
            onClick={onRemove}
            aria-label={`${uiText.bill.remove} ${line.name}`}
          >
            {uiText.bill.remove}
          </Button>
        </Table.Cell>
      </Table.Row>
      {result.error && (
        <Table.Row>
          <Table.Cell colSpan={6}>
            <StatusMessage role="danger" label={uiText.status.error}>
              {line.name}: {result.error}
            </StatusMessage>
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
});
