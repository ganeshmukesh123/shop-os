import { Dialog, Flex } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { ChoiceList } from "./components/ChoiceList";
import { FormulaArea } from "./components/FormulaArea";
import { ShadeFinder } from "./components/ShadeFinder";
import { useTintPicker } from "./hooks/useTintPicker";
import { pickOf } from "./tintPick";
import type { ITintPickerProps } from "./types";

/** The tinting desk (spec 002 T064, FR-014): shade, can, the mix for the tinter, and its price. */
export function TintPicker(props: ITintPickerProps) {
  const { familyId, title, customerName = "", onAdd, onClose } = props;
  const text = uiText.bill.tintPicker;
  const desk = useTintPicker(familyId);
  const add = () => {
    const can = desk.packs.find((pack) => pack.id === desk.choice.packId);
    const chosen = pickOf(can, desk.shade, desk.resolved);
    if (chosen) onAdd(chosen.item, chosen.pick);
  };
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>{text.title.replace("{product}", title)}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.description}
        </Dialog.Description>
        <Flex direction="column" gap="4">
          <ShadeFinder
            query={desk.query}
            shades={desk.shades}
            shadeId={desk.choice.shadeId}
            onQuery={(query) => void desk.setQuery(query)}
            onChoose={(shadeId) => void desk.choose({ shadeId })}
          />
          <ChoiceList
            label={text.packs}
            choices={desk.packs.map((pack) => ({ id: pack.id, label: pack.displayName }))}
            value={desk.choice.packId}
            onChoose={(packId) => void desk.choose({ packId })}
          />
          <FormulaArea desk={desk} customerName={customerName} onAdd={add} />
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
