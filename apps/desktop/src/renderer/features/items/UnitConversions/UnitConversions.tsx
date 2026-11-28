import { Button, Flex, Heading } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { ConversionRowFields } from "./components/ConversionRowFields";
import type { IUnitConversionsProps } from "./types";
import { useUnitConversions } from "./useUnitConversions";

/** A variant's other units, such as a roll of 90 m of wire (spec 002 T037, FR-004). */
export function UnitConversions({
  variantId,
  baseUnit,
  units,
  conversions,
}: IUnitConversionsProps) {
  const panel = useUnitConversions({ variantId, conversions });
  const text = uiText.family.units;
  const unitOptions = units.filter((unit) => unit.code !== baseUnit);
  return (
    <Flex direction="column" gap="3">
      <Heading size="3">{text.title}</Heading>
      {panel.rows.map((row) => (
        <ConversionRowFields
          key={row.key}
          row={row}
          baseUnit={baseUnit}
          unitOptions={unitOptions}
          onUnit={(uomCode) => panel.setUnit(row.key, uomCode)}
          onHolds={(holdsText) => panel.setHolds(row.key, holdsText)}
          onRemove={() => panel.removeRow(row.key)}
        />
      ))}
      {panel.errors.length > 0 && (
        <StatusMessage role="danger" label={uiText.family.errorLabel}>
          {panel.errors.join(" ")}
        </StatusMessage>
      )}
      {panel.isSaved && (
        <StatusMessage role="success" label={text.savedLabel}>
          {text.saved}
        </StatusMessage>
      )}
      <Flex gap="3">
        <Button variant="soft" onClick={panel.addRow}>
          {text.add}
        </Button>
        <Button onClick={() => void panel.save()}>{text.save}</Button>
      </Flex>
    </Flex>
  );
}
