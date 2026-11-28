import { Flex, Heading } from "@radix-ui/themes";
import { PETROLEUM_CLASSES, type PetroleumClass } from "@shopos/core";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import { hasPaintFields } from "../../useFamilyForm/paintDraft";
import { CheckboxRow, SelectRow, TextFieldRow } from "./fieldRows";
import type { IPaintFieldsProps } from "./types";

const text = uiText.family.paint;

const classOptions = PETROLEUM_CLASSES.map((petroleumClass) => ({
  value: petroleumClass,
  label:
    petroleumClass === "NA" ? text.notPetroleum : fillText(text.classLabel, { petroleumClass }),
}));

/** Petroleum class, declared pack, trade label and sealed pack (paint kinds only, FR-009). */
function PaintOnlyFields({ paint, units, onChange }: Omit<IPaintFieldsProps, "kind">) {
  return (
    <>
      <Flex gap="3">
        <SelectRow
          label={`${text.petroleumClass} *`}
          value={paint.petroleumClass}
          options={classOptions}
          onChange={(chosen) => onChange({ petroleumClass: chosen as PetroleumClass })}
        />
        <TextFieldRow
          label={`${text.declaredQty} *`}
          inputMode="decimal"
          value={paint.declaredQtyText}
          onChange={(declaredQtyText) => onChange({ declaredQtyText })}
        />
        <SelectRow
          label={`${text.declaredUom} *`}
          value={paint.declaredUom}
          options={units.map((unit) => ({ value: unit.code, label: unit.label }))}
          onChange={(declaredUom) => onChange({ declaredUom })}
        />
      </Flex>
      <TextFieldRow
        label={text.tradeLabel}
        maxLength={20}
        value={paint.tradeLabel}
        onChange={(tradeLabel) => onChange({ tradeLabel })}
      />
      <CheckboxRow
        label={text.sealedPackOnly}
        isChecked={paint.sealedPackOnly}
        onChange={(sealedPackOnly) => onChange({ sealedPackOnly })}
      />
    </>
  );
}

/** The paint fields when the kind needs them, then warranty and serial tracking (T079). */
export function PaintFields({ kind, paint, units, onChange }: IPaintFieldsProps) {
  return (
    <Flex direction="column" gap="3">
      <Heading size="3">{text.title}</Heading>
      {hasPaintFields(kind) && <PaintOnlyFields paint={paint} units={units} onChange={onChange} />}
      <Flex gap="3" align="end">
        <TextFieldRow
          label={text.warranty}
          inputMode="numeric"
          value={paint.warrantyText}
          onChange={(warrantyText) => onChange({ warrantyText })}
        />
        <CheckboxRow
          label={text.serialTracked}
          isChecked={paint.isSerialTracked}
          onChange={(isSerialTracked) => onChange({ isSerialTracked })}
        />
      </Flex>
    </Flex>
  );
}
