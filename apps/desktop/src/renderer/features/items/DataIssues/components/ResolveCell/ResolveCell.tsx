import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import type { IExceptionEvent } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import type { IResolveCellProps } from "./types";

/** The note of a resolved issue, or Resolve, or the open note box (spec 002 T052). */
export function ResolveCell({ event, isResolving, note, ...actions }: IResolveCellProps) {
  const text = uiText.dataIssues;
  if (event.status === "resolved") return <Text size="2">{resolutionOf(event)}</Text>;
  return isResolving ? (
    <Flex gap="2" align="center" wrap="wrap">
      <TextField.Root
        aria-label={text.note}
        value={note}
        onChange={(changeEvent) => actions.onNote(changeEvent.target.value)}
      />
      <Button size="2" onClick={actions.onConfirm}>
        {text.confirm}
      </Button>
    </Flex>
  ) : (
    <Button size="2" variant="soft" onClick={actions.onStart}>
      {text.resolve}
    </Button>
  );
}

const resolutionOf = (event: IExceptionEvent) => event.resolutionNote ?? "";
