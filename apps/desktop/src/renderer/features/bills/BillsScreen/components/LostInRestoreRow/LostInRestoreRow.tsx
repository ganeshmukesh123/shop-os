import { Table, Text } from "@radix-ui/themes";
import { StatusBadge } from "../../../../../shared/components/StatusBadge/StatusBadge";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { ILostInRestoreRowProps } from "./types";

/**
 * A run of bill numbers a restore lost, in the bill list so the owner sees why they are missing
 * (FR-013b). It says "Lost in restore" in words, and when the run is only a guess says so.
 */
export function LostInRestoreRow({ gap }: ILostInRestoreRowProps) {
  const text = uiText.bills;
  return (
    <Table.Row>
      <Table.RowHeaderCell>
        {fillText(text.lostRange, { from: gap.fromNumber, to: gap.toNumber })}
      </Table.RowHeaderCell>
      <Table.Cell>{new Date(gap.recordedAt).toLocaleString()}</Table.Cell>
      <Table.Cell colSpan={3}>
        {gap.isEstimated && (
          <Text size="2" color="gray">
            {text.lostEstimated}
          </Text>
        )}
      </Table.Cell>
      <Table.Cell>
        <StatusBadge role="warning" label={text.lostInRestore} />
      </Table.Cell>
    </Table.Row>
  );
}
