import { useState } from "react";
import { Button, Dialog, Flex, RadioGroup, Text, TextArea, TextField } from "@radix-ui/themes";
import { formatQuantity, parseQuantity, type Item } from "@shopos/core";
import { uiText } from "../strings";
import { call, messageOf } from "../state/api";
import { useToast } from "./Toast";

export function AdjustStockDialog({
  item,
  onClose,
  onDone,
}: {
  item: Item;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"add" | "set">("add");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    // "add" may be negative to remove stock: a leading minus is allowed only in add mode.
    const neg = mode === "add" && qty.trim().startsWith("-");
    const parsed = parseQuantity(neg ? qty.trim().slice(1) : qty);
    if (parsed === null) return setError("Enter a quantity, for example 5 or 2.5");
    if (!note.trim()) return setError("A note is required");
    setBusy(true);
    try {
      await call("stock.adjust", {
        itemId: item.id,
        mode,
        quantityMilli: neg ? -parsed : parsed,
        note,
      });
      toast("success", `${item.name}: stock updated`);
      onDone();
    } catch (caughtError) {
      setError(messageOf(caughtError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>
          {uiText.adjust.title}: {item.name}
        </Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Current stock: {formatQuantity(item.stockMilli)} {item.unit}
        </Dialog.Description>
        <Flex direction="column" gap="3">
          <RadioGroup.Root
            value={mode}
            onValueChange={(selectedMode) => setMode(selectedMode as "add" | "set")}
            aria-label={uiText.adjust.mode}
          >
            <RadioGroup.Item value="add">{uiText.adjust.add}</RadioGroup.Item>
            <RadioGroup.Item value="set">{uiText.adjust.set}</RadioGroup.Item>
          </RadioGroup.Root>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.adjust.quantity} ({item.unit})
            </Text>
            <TextField.Root
              size="3"
              autoFocus
              inputMode="decimal"
              value={qty}
              onChange={(changeEvent) => setQty(changeEvent.target.value)}
              onKeyDown={(keyboardEvent) => keyboardEvent.key === "Enter" && void save()}
            />
          </label>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.adjust.note}
            </Text>
            <TextArea
              size="3"
              maxLength={200}
              value={note}
              onChange={(changeEvent) => setNote(changeEvent.target.value)}
            />
          </label>
          {error && (
            <Text color="red" role="alert">
              Error: {error}
            </Text>
          )}
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" size="3" onClick={onClose}>
            {uiText.form.cancel}
          </Button>
          <Button size="3" onClick={() => void save()} loading={busy}>
            {uiText.adjust.save}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
