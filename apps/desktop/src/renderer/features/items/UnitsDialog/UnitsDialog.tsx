import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { fillText } from "../../../shared/text/fillText";
import { uiText } from "../../../shared/text/strings";
import { useCatalogueLists } from "../hooks/useCatalogueLists";
import { UnitConversions } from "../UnitConversions";
import type { IUnitsDialogProps } from "./types";
import { useItemConversions } from "./useItemConversions";

/** An item's other units (spec 002 T037), opened from its row on the Items screen. */
export function UnitsDialog({ item, onClose }: IUnitsDialogProps) {
  const { conversions, error } = useItemConversions(item);
  const lists = useCatalogueLists(true);
  const isReady = conversions !== null && lists.isLoaded;
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>
          {fillText(uiText.family.units.dialogTitle, { item: item.name })}
        </Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {item.unit}
        </Dialog.Description>
        <Flex direction="column" gap="3">
          {(error ?? lists.error) && (
            <StatusMessage role="danger" label={uiText.family.errorLabel}>
              {error ?? lists.error}
            </StatusMessage>
          )}
          {!isReady && !error && <Text>{uiText.common.loading}…</Text>}
          {isReady && (
            <UnitConversions
              variantId={item.id}
              baseUnit={item.unit}
              units={lists.units}
              conversions={conversions}
            />
          )}
          <Flex justify="end">
            <Button size="3" variant="soft" color="gray" onClick={onClose}>
              {uiText.common.close}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
