import { forwardRef } from "react";
import { Button, Flex, SegmentedControl, Table, Text, TextField } from "@radix-ui/themes";
import { formatRupees, type DraftLine, type DraftLineResult } from "@shopos/core";
import { StatusMessage } from "../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../strings";

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
        <Table.Cell style={{ width: 110 }}>
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
        <Table.Cell style={{ width: 130 }}>
          <TextField.Root
            size="3"
            inputMode="decimal"
            aria-label={`${uiText.bill.rate} ${line.name}`}
            value={line.rate}
            onFocus={(focusEvent) => focusEvent.target.select()}
            onChange={(changeEvent) => onChange({ rate: changeEvent.target.value })}
          />
        </Table.Cell>
        <Table.Cell style={{ width: 230 }}>
          <Flex gap="2" align="center">
            <TextField.Root
              size="3"
              style={{ width: 90 }}
              inputMode="decimal"
              aria-label={`${uiText.bill.discount} ${line.name}`}
              value={line.disc}
              onChange={(changeEvent) => onChange({ disc: changeEvent.target.value })}
            />
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
        <Table.Cell justify="end" style={{ width: 130, fontWeight: 600 }}>
          {result.amountPaise === null ? "–" : formatRupees(result.amountPaise)}
        </Table.Cell>
        <Table.Cell style={{ width: 90 }}>
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
