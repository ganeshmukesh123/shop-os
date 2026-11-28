import { Button, Dialog, Flex } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { VariantPreview } from "../VariantPreview";
import { AxisPicker } from "./components/AxisPicker";
import { FamilyHeaderFields } from "./components/FamilyHeaderFields";
import { PaintFields } from "./components/PaintFields";
import type { IFamilyFormProps } from "./types";
import { useFamilyForm } from "./useFamilyForm";

/**
 * A new item family (spec 002 T036, quickstart scenario 1): its own fields, up to 4 attributes,
 * the combinations to keep with a price and opening stock each, then Save.
 */
export function FamilyForm({ categories, brands, units, onClose, onSaved }: IFamilyFormProps) {
  const form = useFamilyForm({ onSaved });
  const text = uiText.family;
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="760px">
        <Dialog.Title>{text.addTitle}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.requiredNote}
        </Dialog.Description>
        <Flex direction="column" gap="4">
          <FamilyHeaderFields {...form} categories={categories} brands={brands} units={units} />
          <PaintFields kind={form.kind} paint={form.paint} units={units} onChange={form.setPaint} />
          <AxisPicker
            axisKeys={form.axisKeys}
            axisValuesText={form.axisValuesText}
            axisLimitReason={form.axisLimitReason}
            onToggle={form.toggleAxis}
            onValuesChange={form.setAxisValuesText}
          />
          <Flex>
            <Button size="3" variant="soft" onClick={() => void form.preview()}>
              {text.preview}
            </Button>
          </Flex>
          <VariantPreview
            rows={form.rows}
            unit={form.unit}
            onToggle={form.toggleRow}
            onPrice={form.setRowPrice}
            onOpening={form.setRowOpening}
          />
          {form.errors.length > 0 && (
            <StatusMessage role="danger" label={text.errorLabel}>
              {form.errors.join(" ")}
            </StatusMessage>
          )}
          <Flex gap="3" justify="end">
            <Button size="3" variant="soft" color="gray" onClick={onClose}>
              {uiText.common.close}
            </Button>
            <Button size="3" loading={form.isBusy} onClick={() => void form.save()}>
              {text.save}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
