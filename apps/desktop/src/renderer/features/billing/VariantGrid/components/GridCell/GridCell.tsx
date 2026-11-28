import { Button, Flex, Text } from "@radix-ui/themes";
import { formatQuantity, formatRupees } from "@shopos/core";
import { StatusBadge } from "../../../../../shared/components/StatusBadge/StatusBadge";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { IGridCellProps } from "./types";

const text = uiText.bill.grid;

/** One variant in the grid: price and stock, a word for negative stock; press to add it. */
export function GridCell({ cell, item, row, column, onPick }: IGridCellProps) {
  if (!cell || !item) {
    return (
      <Text size="2" color="gray">
        {text.notStocked}
      </Text>
    );
  }
  const isNegative = cell.stockMilli < 0;
  const label = fillText(text.cell, {
    variant: item.name,
    price: formatRupees(cell.pricePaise),
    quantity: formatQuantity(cell.stockMilli),
  });
  const extras = [isNegative ? text.negative : null, cell.isActive ? null : text.inactive];
  return (
    <Button
      variant="soft"
      size="3"
      data-row={row}
      data-column={column}
      disabled={!cell.isActive}
      aria-label={[label, ...extras].filter(Boolean).join(". ")}
      onClick={() => onPick(item)}
    >
      <Flex direction="column" align="start">
        <Text size="2">{formatRupees(cell.pricePaise)}</Text>
        <Text size="1">{formatQuantity(cell.stockMilli)}</Text>
        {isNegative && <StatusBadge role="warning" label={text.negative} />}
      </Flex>
    </Button>
  );
}
