import { Table } from "@radix-ui/themes";
import type { ITintShade } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import type { IShadeTableProps } from "./types";

const kindOf = (shade: ITintShade) =>
  shade.source === "library"
    ? uiText.tinting.shades.library
    : uiText.tinting.shades.customFor.replace(
        "{label}",
        shade.customerLabel ?? shade.siteLabel ?? "",
      );

/** One row per shade: name, code, and library or whose custom shade (spec 002 T066). */
export function ShadeTable({ shades }: IShadeTableProps) {
  const text = uiText.tinting.shades;
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{text.name}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.code}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.kind}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {shades.map((shade) => (
          <Table.Row key={shade.id}>
            <Table.RowHeaderCell>{shade.shadeName}</Table.RowHeaderCell>
            <Table.Cell>{shade.shadeCode}</Table.Cell>
            <Table.Cell>{kindOf(shade)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
