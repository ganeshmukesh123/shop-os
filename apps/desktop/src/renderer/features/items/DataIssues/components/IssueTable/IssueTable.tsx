import { Table, Text } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { ResolveCell } from "../ResolveCell";
import type { IIssueTableProps } from "./types";

/** One row per issue, said in words: what kind, about what, which items (spec 002 T052). */
export function IssueTable({ events, resolving, emptyText }: IIssueTableProps) {
  const text = uiText.dataIssues;
  if (events.length === 0) return <Text color="gray">{emptyText}</Text>;
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>{text.issue}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.about}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.items}</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>{text.action}</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {events.map((event) => (
          <Table.Row key={event.id}>
            <Table.RowHeaderCell>{text.kinds[event.kind] ?? event.kind}</Table.RowHeaderCell>
            <Table.Cell>{event.detail}</Table.Cell>
            <Table.Cell>{event.subjectNames.join(", ")}</Table.Cell>
            <Table.Cell>
              <ResolveCell
                event={event}
                isResolving={resolving.resolvingId === event.id}
                note={resolving.note}
                onStart={() => resolving.start(event.id)}
                onNote={resolving.setNote}
                onConfirm={() => void resolving.confirm()}
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
