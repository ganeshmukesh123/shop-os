import { Button, Dialog, Flex } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { MergePreview } from "./components/MergePreview";
import { ReasonField } from "./components/ReasonField";
import { SurvivorPicker } from "./components/SurvivorPicker";
import { useMergeForm } from "./hooks/useMergeForm";
import type { IMergeDialogProps } from "./types";

/**
 * Merge a duplicate into the item to keep (spec 002 T051, research D6): pick it, see what moves,
 * give a reason, merge. Saved bills never change.
 */
export function MergeDialog({ item, onClose, onMerged }: IMergeDialogProps) {
  const form = useMergeForm(item, onMerged);
  const text = uiText.merge;
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>{text.title.replace("{item}", item.name)}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.description}
        </Dialog.Description>
        <Flex direction="column" gap="4">
          <SurvivorPicker
            query={form.query}
            matches={form.matches}
            survivorId={form.survivor?.id ?? ""}
            onQuery={(nextQuery) => void form.setQuery(nextQuery)}
            onChoose={form.setSurvivorId}
          />
          {form.survivor && <MergePreview merged={item} survivor={form.survivor} />}
          <ReasonField reason={form.reason} error={form.error} onReason={form.setReason} />
          <Flex gap="3" justify="end">
            <Button size="3" variant="soft" color="gray" onClick={onClose}>
              {uiText.common.close}
            </Button>
            <Button size="3" loading={form.isBusy} onClick={() => void form.merge()}>
              {text.merge}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
