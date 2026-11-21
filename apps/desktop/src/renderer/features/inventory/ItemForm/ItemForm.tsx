import { Box, Button, Checkbox, Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage/StatusMessage";
import { formatQuantity, UNITS } from "@shopos/core";
import { uiText } from "../../../shared/text/strings";
import { CUSTOM_UNIT_OPTION } from "./constants";
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
          <Flex gap="3">
            <Box flexGrow="1" asChild>
              <label>
                <Text as="div" size="2" weight="bold" mb="1">
                  {uiText.form.unit} *
                </Text>
                <Select.Root value={fields.unitChoice} onValueChange={fields.chooseUnit}>
                  <Select.Trigger className="shopos-full-width" aria-label={uiText.form.unit} />
                  <Select.Content>
                    {UNITS.map((unitOption) => (
                      <Select.Item key={unitOption} value={unitOption}>
                        {unitOption}
                      </Select.Item>
                    ))}
                    <Select.Item value={CUSTOM_UNIT_OPTION}>Custom…</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>
            </Box>
            {fields.unitChoice === CUSTOM_UNIT_OPTION && (
              <Box flexGrow="1" asChild>
                <label>
                  <Text as="div" size="2" weight="bold" mb="1">
                    {uiText.form.customUnit}
                  </Text>
                  <TextField.Root
                    size="3"
                    maxLength={20}
                    value={fields.customUnit}
                    onChange={(changeEvent) => fields.setCustomUnit(changeEvent.target.value)}
                  />
                </label>
              </Box>
            )}
          </Flex>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={fields.allowsDecimal}
                disabled={isEditing || fields.unitChoice !== CUSTOM_UNIT_OPTION}
                onCheckedChange={(checkedState) => fields.setAllowsDecimal(checkedState === true)}
              />
              {uiText.form.allowsDecimal}
            </Flex>
          </Text>
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
          {errors.map((errorMessage) => (
            <StatusMessage key={errorMessage} role="danger" label={uiText.status.error}>
              {errorMessage}
            </StatusMessage>
          ))}
          {duplicateItems.length > 0 && (
            <StatusMessage role="warning" label={uiText.status.duplicate}>
              {uiText.form.duplicateTitle}. {uiText.form.duplicateHelp}{" "}
              {duplicateItems
                .map(
                  (duplicateItem) =>
                    `${duplicateItem.name} (${formatQuantity(duplicateItem.stockMilli)} ${duplicateItem.unit} in stock)`,
                )
                .join("; ")}
            </StatusMessage>
          )}
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
