import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { fillText } from "../../../shared/text/fillText";
import { uiText } from "../../../shared/text/strings";
import { GridTabs } from "./components/GridTabs";
import type { IVariantGridProps } from "./types";
import { useFamilyGrid } from "./useFamilyGrid";

/** A family's variants as a grid on the bill (spec 002 T038); axes 3 and 4 become tabs. */
export function VariantGrid({ familyId, title, onPick, onClose }: IVariantGridProps) {
  const { grid, error } = useFamilyGrid(familyId);
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="900px">
        <Dialog.Title>{fillText(uiText.bill.grid.title, { family: title })}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {uiText.bill.grid.familyRow}
        </Dialog.Description>
        {error && (
          <StatusMessage role="danger" label={uiText.status.error}>
            {error}
          </StatusMessage>
        )}
        {!grid && !error && <Text>{uiText.common.loading}…</Text>}
        {grid && <GridTabs tabs={grid.tabs} items={grid.items} onPick={onPick} />}
        <Flex justify="end" mt="3">
          <Button size="3" variant="soft" color="gray" onClick={onClose}>
            {uiText.common.close}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
