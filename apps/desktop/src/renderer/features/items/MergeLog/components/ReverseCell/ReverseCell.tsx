import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { StatusBadge } from "../../../../../shared/components/StatusBadge";
import { uiText } from "../../../../../shared/text/strings";
import type { IReverseCellProps } from "./types";

/** Reversed, closed, Reverse with the days left, or the open reason box (spec 002 T051). */
export function ReverseCell({
  isReversed,
  daysLeft,
  isReversing,
  reason,
  ...actions
}: IReverseCellProps) {
  const text = uiText.mergeLog;
  if (isReversed) return <StatusBadge role="neutral" label={text.reversed} />;
  if (daysLeft === 0)
    return (
      <Text size="2" color="gray">
        {text.closed}
      </Text>
    );
  const daysText =
    daysLeft === 1 ? text.oneDayLeft : text.daysLeft.replace("{days}", String(daysLeft));
  return isReversing ? (
    <Flex gap="2" align="center" wrap="wrap">
      <TextField.Root
        aria-label={text.reason}
        value={reason}
        onChange={(event) => actions.onReason(event.target.value)}
      />
      <Button size="2" color="amber" onClick={actions.onConfirm}>
        {text.confirm}
      </Button>
    </Flex>
  ) : (
    <Flex gap="2" align="center">
      <Button size="2" variant="soft" onClick={actions.onStartReverse}>
        {text.reverse}
      </Button>
      <Text size="2" color="gray">
        {daysText}
      </Text>
    </Flex>
  );
}
