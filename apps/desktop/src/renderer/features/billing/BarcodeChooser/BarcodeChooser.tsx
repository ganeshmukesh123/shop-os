import { Button, Dialog, Flex } from "@radix-ui/themes";
import { formatRupees } from "@shopos/core";
import { uiText } from "../../../shared/text/strings";
import type { IBarcodeChooserProps } from "./types";

/** One scanned code on two or more items: the cashier picks the one being sold (EC-07, T052). */
export function BarcodeChooser({ code, items, onChoose, onClose }: IBarcodeChooserProps) {
  const text = uiText.bill.barcode;
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{text.title.replace("{code}", code)}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.description}
        </Dialog.Description>
        <Flex direction="column" gap="2">
          {items.map((item, itemIndex) => (
            <Button
              key={item.id}
              size="3"
              variant="soft"
              autoFocus={itemIndex === 0}
              onClick={() => onChoose(item)}
            >
              {item.name}: {formatRupees(item.pricePaise)}
            </Button>
          ))}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
