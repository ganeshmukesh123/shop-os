import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { formatQuantity } from "@shopos/core";
import { uiText } from "../../../shared/text/strings";
import { ItemFormMessages } from "./components/ItemFormMessages";
import { ItemUnitFields } from "./components/ItemUnitFields";
import type { IItemFormProps } from "./types";
import { useItemFormFields } from "./useItemFormFields";
import { useItemFormSave } from "./useItemFormSave";

/** Add (no `item`) or edit an item. Duplicate names are listed and block saving until renamed. */
export function ItemForm({ item, onClose, onDone }: IItemFormProps) {
  const fields = useItemFormFields(item);
  const { errors, duplicateItems, isBusy, save } = useItemFormSave(fields, item, onDone);
  const { isEditing } = fields;

  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{isEditing ? uiText.form.editTitle : uiText.form.addTitle}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Fields marked * are required.
        </Dialog.Description>
        <Flex
          direction="column"
          gap="3"
          onKeyDown={(keyboardEvent) => {
            if (
              keyboardEvent.key === "Enter" &&
              (keyboardEvent.target as HTMLElement).tagName === "INPUT"
            )
              void save();
          }}
        >
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.form.name} *
            </Text>
            <TextField.Root
              size="3"
              autoFocus
              maxLength={120}
              value={fields.name}
              onChange={(changeEvent) => fields.setName(changeEvent.target.value)}
            />
          </label>
          <ItemUnitFields fields={fields} />
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.form.price} *
            </Text>
            <TextField.Root
              size="3"
              inputMode="decimal"
              value={fields.priceText}
              onChange={(changeEvent) => fields.setPriceText(changeEvent.target.value)}
            />
          </label>
          {!isEditing && (
            <label>
              <Text as="div" size="2" weight="bold" mb="1">
                {uiText.form.opening}
              </Text>
              <TextField.Root
                size="3"
                inputMode="decimal"
                value={fields.openingText}
                onChange={(changeEvent) => fields.setOpeningText(changeEvent.target.value)}
                placeholder="0"
              />
            </label>
          )}
          {item && (
            <Text size="2" color="gray">
              Current stock {formatQuantity(item.stockMilli)} {item.unit}. Use “
              {uiText.items.adjust}” to change stock.
            </Text>
          )}
          <ItemFormMessages errors={errors} duplicateItems={duplicateItems} />
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" size="3" onClick={onClose}>
            {uiText.form.cancel}
          </Button>
          <Button size="3" onClick={() => void save()} loading={isBusy}>
            {uiText.form.save}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
