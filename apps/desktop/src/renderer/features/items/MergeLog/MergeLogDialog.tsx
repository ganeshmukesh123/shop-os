import { Dialog, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { MergeLogTable } from "./components/MergeLogTable";
import { useMergeLog } from "./hooks/useMergeLog";
import { useReverseMerge } from "./hooks/useReverseMerge";
import type { IMergeLogDialogProps } from "./types";

/** The latest merges with Reverse while the 30 days last (spec 002 T051, research D6). */
export function MergeLogDialog({ onClose, onReversed }: IMergeLogDialogProps) {
  const text = uiText.mergeLog;
  const log = useMergeLog();
  const reversal = useReverseMerge(() => {
    void log.load();
    onReversed();
  });
  const error = reversal.error ?? log.error;
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="820px">
        <Dialog.Title>{text.title}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.description}
        </Dialog.Description>
        {error && (
          <StatusMessage role="danger" label={text.errorLabel}>
            {error}
          </StatusMessage>
        )}
        <MergeLogTable merges={log.merges} reversal={reversal} />
        {log.merges.length === 0 && <Text color="gray">{text.empty}</Text>}
      </Dialog.Content>
    </Dialog.Root>
  );
}
