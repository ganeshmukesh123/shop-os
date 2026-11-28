import { Button, Flex } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import type { IItemRowActionsProps } from "./types";

/** An item row's buttons: Edit, Adjust stock, Units (spec 002 T037) and Deactivate or Reactivate. */
export function ItemRowActions({
  item,
  onEdit,
  onAdjust,
  onUnits,
  onToggleActive,
}: IItemRowActionsProps) {
  return (
    <Flex gap="2" justify="end">
      <Button size="2" variant="soft" onClick={onEdit}>
        {uiText.items.edit}
      </Button>
      <Button size="2" variant="soft" onClick={onAdjust}>
        {uiText.items.adjust}
      </Button>
      <Button size="2" variant="soft" onClick={onUnits}>
        {uiText.family.units.open}
      </Button>
      <Button size="2" variant="soft" color="gray" onClick={onToggleActive}>
        {item.active ? uiText.items.deactivate : uiText.items.reactivate}
      </Button>
    </Flex>
  );
}
