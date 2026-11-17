import { useState } from "react";
import { Box, Button, Checkbox, Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { StatusMessage } from "../shared/components/StatusMessage/StatusMessage";
import {
  defaultAllowsDecimal,
  formatQuantity,
  paiseToInput,
  parseQuantity,
  parseRupees,
  UNITS,
  type Item,
} from "@shopos/core";
import { uiText } from "../strings";
import { ApiError, call, messageOf } from "../state/api";
import { useToast } from "../components/Toast";

const CUSTOM = "__custom__";

/** Add (no `item`) or edit an item. Duplicate names are listed and block saving until renamed. */
export function ItemForm({
  item,
  onClose,
  onDone,
}: {
  item?: Item;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const editing = !!item;
  const startUnit = item?.unit ?? "pcs";
  const isBuiltin = (UNITS as readonly string[]).includes(startUnit);
  const [name, setName] = useState(item?.name ?? "");
  const [unitSel, setUnitSel] = useState(isBuiltin ? startUnit : CUSTOM);
  const [custom, setCustom] = useState(isBuiltin ? "" : startUnit);
  const [decimalOverride, setDecimalOverride] = useState<boolean | null>(
    item ? item.allowsDecimal : null,
  );
  const [price, setPrice] = useState(item ? paiseToInput(item.pricePaise) : "");
  const [opening, setOpening] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [dupes, setDupes] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const unit = unitSel === CUSTOM ? custom.trim() : unitSel;
  const allowsDecimal = decimalOverride ?? defaultAllowsDecimal(unit);

  async function save() {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Enter the item name");
    if (!unit) errs.push("Choose or type a unit");
    if (unit.length > 20) errs.push("Unit name can be at most 20 characters");
    const pricePaise = parseRupees(price);
    if (pricePaise === null) errs.push("Enter the price in rupees, for example 120 or 49.50");
    let openingQtyMilli = 0;
    if (!editing && opening.trim() !== "") {
      const openingQuantityMilli = parseQuantity(opening);
      if (openingQuantityMilli === null)
        errs.push("Enter the opening quantity as a number, for example 10 or 2.5");
      else openingQtyMilli = openingQuantityMilli;
    }
    if (!editing && !allowsDecimal && openingQtyMilli % 1000 !== 0)
      errs.push("This unit accepts whole numbers only");
    setErrors(errs);
    setDupes([]);
    if (errs.length || pricePaise === null) return;
    setBusy(true);
    try {
      if (editing) await call("items.update", { id: item.id, name: name.trim(), unit, pricePaise });
      else
        await call("items.create", {
          name: name.trim(),
          unit,
          allowsDecimal,
          pricePaise,
          openingQtyMilli,
        });
      toast("success", `${name.trim()} saved`);
      onDone();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === "DUPLICATE_NAME")
        setDupes(caughtError.details as Item[]);
      else setErrors([messageOf(caughtError)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>{editing ? uiText.form.editTitle : uiText.form.addTitle}</Dialog.Title>
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
              value={name}
              onChange={(changeEvent) => setName(changeEvent.target.value)}
            />
          </label>
          <Flex gap="3">
            <Box flexGrow="1" asChild>
              <label>
                <Text as="div" size="2" weight="bold" mb="1">
                  {uiText.form.unit} *
                </Text>
                <Select.Root
                  value={unitSel}
                  onValueChange={(selectedUnit) => {
                    setUnitSel(selectedUnit);
                    setDecimalOverride(null);
                  }}
                >
                  <Select.Trigger className="shopos-full-width" aria-label={uiText.form.unit} />
                  <Select.Content>
                    {UNITS.map((unitOption) => (
                      <Select.Item key={unitOption} value={unitOption}>
                        {unitOption}
                      </Select.Item>
                    ))}
                    <Select.Item value={CUSTOM}>Custom…</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>
            </Box>
            {unitSel === CUSTOM && (
              <Box flexGrow="1" asChild>
                <label>
                  <Text as="div" size="2" weight="bold" mb="1">
                    {uiText.form.customUnit}
                  </Text>
                  <TextField.Root
                    size="3"
                    maxLength={20}
                    value={custom}
                    onChange={(changeEvent) => setCustom(changeEvent.target.value)}
                  />
                </label>
              </Box>
            )}
          </Flex>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Checkbox
                checked={allowsDecimal}
                disabled={editing || unitSel !== CUSTOM}
                onCheckedChange={(checkedState) => setDecimalOverride(checkedState === true)}
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
              value={price}
              onChange={(changeEvent) => setPrice(changeEvent.target.value)}
            />
          </label>
          {!editing && (
            <label>
              <Text as="div" size="2" weight="bold" mb="1">
                {uiText.form.opening}
              </Text>
              <TextField.Root
                size="3"
                inputMode="decimal"
                value={opening}
                onChange={(changeEvent) => setOpening(changeEvent.target.value)}
                placeholder="0"
              />
            </label>
          )}
          {editing && (
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
          {dupes.length > 0 && (
            <StatusMessage role="warning" label={uiText.status.duplicate}>
              {uiText.form.duplicateTitle}. {uiText.form.duplicateHelp}{" "}
              {dupes
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
          <Button size="3" onClick={() => void save()} loading={busy}>
            {uiText.form.save}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
