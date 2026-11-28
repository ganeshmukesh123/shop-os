import { Checkbox, Table, TextField } from "@radix-ui/themes";
import { fillText } from "../../../shared/text/fillText";
import { uiText } from "../../../shared/text/strings";
import type { IVariantPreviewProps } from "./types";

/** Every combination with a tick box to keep it, and its price and opening stock (spec 002 T036). */
export function VariantPreview({ rows, unit, onToggle, onPrice, onOpening }: IVariantPreviewProps) {
  if (rows.length === 0) return null;
  const text = uiText.family;
  return (
    <Table.Root size="1" aria-label={text.combinations}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{text.keep}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.variant}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.price}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{fillText(text.openingColumn, { unit })}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.axisSignature}>
            <Table.Cell>
              <Checkbox
                aria-label={fillText(text.keepVariant, { variant: row.displayName })}
                checked={row.isChosen}
                onCheckedChange={() => onToggle(row.axisSignature)}
              />
            </Table.Cell>
            <Table.RowHeaderCell>{row.displayName}</Table.RowHeaderCell>
            <Table.Cell>
              <TextField.Root
                aria-label={fillText(text.priceFor, { variant: row.displayName })}
                inputMode="decimal"
                disabled={!row.isChosen}
                value={row.priceText}
                onChange={(changeEvent) => onPrice(row.axisSignature, changeEvent.target.value)}
              />
            </Table.Cell>
            <Table.Cell>
              <TextField.Root
                aria-label={fillText(text.openingFor, { unit, variant: row.displayName })}
                inputMode="decimal"
                disabled={!row.isChosen}
                value={row.openingText}
                onChange={(changeEvent) => onOpening(row.axisSignature, changeEvent.target.value)}
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
