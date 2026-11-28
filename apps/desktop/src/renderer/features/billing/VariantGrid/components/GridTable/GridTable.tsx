import { Table } from "@radix-ui/themes";
import type { Item } from "@shopos/core";
import { moveFocusInGrid } from "../../gridKeys";
import { GridCell } from "../GridCell";
import type { IGridTableProps } from "./types";

/** One tab of the grid: axis 1 down the side, axis 2 across the top (research D15). */
export function GridTable({ tab, items, onPick }: IGridTableProps) {
  const itemById = new Map<string, Item>(items.map((item) => [item.id, item]));
  return (
    <Table.Root size="2" onKeyDown={moveFocusInGrid}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell />
          {tab.columnValues.map((columnValue) => (
            <Table.ColumnHeaderCell key={columnValue}>{columnValue}</Table.ColumnHeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {tab.rowValues.map((rowValue, rowIndex) => (
          <Table.Row key={rowValue}>
            <Table.RowHeaderCell>{rowValue}</Table.RowHeaderCell>
            {tab.cells[rowIndex]!.map((cell, columnIndex) => (
              <Table.Cell key={tab.columnValues[columnIndex]}>
                <GridCell
                  cell={cell}
                  item={cell ? itemById.get(cell.variantId) : undefined}
                  row={rowIndex}
                  column={columnIndex}
                  onPick={onPick}
                />
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
