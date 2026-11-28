import { Flex, Text } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { useCustomShade } from "../../hooks/useCustomShade";
import { ColorantLines } from "../ColorantLines";
import { LabelledField } from "../LabelledField";
import { ShadeFormActions } from "../ShadeFormActions";
import type { ICustomShadeFormProps } from "./types";

/** Name the shade, say whose it is, list the colorants in ml for one can, and save (T064). */
export function CustomShadeForm({
  baseVariantId,
  customerName,
  onSaved,
  onCancel,
}: ICustomShadeFormProps) {
  const text = uiText.bill.tintPicker.custom;
  const form = useCustomShade(baseVariantId, customerName, onSaved);
  return (
    <Flex direction="column" gap="3">
      <Text weight="bold">{text.title}</Text>
      <LabelledField
        label={text.name}
        value={form.draft.name}
        onChange={(name) => form.change({ name })}
      />
      <LabelledField
        label={text.customer}
        value={form.draft.customerLabel}
        onChange={(customerLabel) => form.change({ customerLabel })}
      />
      <LabelledField
        label={text.site}
        value={form.draft.siteLabel}
        onChange={(siteLabel) => form.change({ siteLabel })}
      />
      <ColorantLines form={form} />
      <ShadeFormActions error={form.error} onCancel={onCancel} onSave={() => void form.save()} />
    </Flex>
  );
}
