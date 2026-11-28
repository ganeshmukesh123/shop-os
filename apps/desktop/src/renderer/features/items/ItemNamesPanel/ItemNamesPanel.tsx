import { Button, Dialog, Flex } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { BarcodeList } from "./components/BarcodeList";
import { SearchNameList } from "./components/SearchNameList";
import { useItemCodes } from "./hooks/useItemCodes";
import type { IItemNamesPanelProps } from "./types";

/** An item's search names and barcodes (spec 002 T049); a shared code is said after saving. */
export function ItemNamesPanel({ item, onClose }: IItemNamesPanelProps) {
  const text = uiText.names;
  const codes = useItemCodes(item, onClose);
  const shared = codes.sharedWith.map((share) =>
    text.sharedWith.replace("{code}", share.code).replace("{items}", share.displayName),
  );
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>{text.title.replace("{item}", item.name)}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.description}
        </Dialog.Description>
        <Flex direction="column" gap="4">
          <SearchNameList names={codes.names} onChange={codes.setNames} />
          <BarcodeList codes={codes.codes} onChange={codes.setCodes} />
          {shared.map((message) => (
            <StatusMessage key={message} role="warning" label={text.sharedLabel}>
              {message}
            </StatusMessage>
          ))}
          {codes.error && (
            <StatusMessage role="danger" label={text.errorLabel}>
              {codes.error}
            </StatusMessage>
          )}
          <Flex gap="3" justify="end">
            <Button size="3" variant="soft" color="gray" onClick={onClose}>
              {uiText.common.close}
            </Button>
            <Button size="3" onClick={() => void codes.save()}>
              {text.save}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
