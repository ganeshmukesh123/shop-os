import { Table } from "@radix-ui/themes";
import { businessDateOf } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import { SHOP_TIME_ZONE } from "../../constants";
import { reversalDaysLeft } from "../../reversalDaysLeft";
import { ReverseCell } from "../ReverseCell";
import type { IMergeLogRowProps } from "./types";

/** One merge: what went into what, when, and whether and for how long it can be reversed. */
export function MergeLogRow({ merge, nowMs, ...reverse }: IMergeLogRowProps) {
  const name = uiText.mergeLog.mergedInto
    .replace("{merged}", merge.mergedName)
    .replace("{survivor}", merge.survivorName);
  return (
    <Table.Row>
      <Table.RowHeaderCell>{name}</Table.RowHeaderCell>
      <Table.Cell>{businessDateOf(merge.createdAt, SHOP_TIME_ZONE)}</Table.Cell>
      <Table.Cell>
        <ReverseCell
          isReversed={merge.isReversed}
          daysLeft={reversalDaysLeft(merge.reversibleUntil, nowMs)}
          {...reverse}
        />
      </Table.Cell>
    </Table.Row>
  );
}
