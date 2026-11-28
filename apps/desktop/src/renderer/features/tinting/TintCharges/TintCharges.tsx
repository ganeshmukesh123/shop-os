import { Button, Flex, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { ChargeRow } from "./components/ChargeRow";
import { useTintCharges } from "./hooks/useTintCharges";

/** The tint charge per pack size, e.g. 4 L ₹60.00 (spec 002 T066, FR-015). */
export function TintCharges() {
  const text = uiText.tinting.charges;
  const charges = useTintCharges();
  return (
    <Flex direction="column" gap="3" pt="3">
      <Text color="gray">{text.description}</Text>
      {charges.rows.map((row) => (
        <ChargeRow
          key={row.key}
          row={row}
          onChange={(patch) => charges.change(row.key, patch)}
          onRemove={() => charges.removeRow(row.key)}
        />
      ))}
      {charges.error && (
        <StatusMessage role="danger" label={uiText.tinting.errorLabel}>
          {charges.error}
        </StatusMessage>
      )}
      <Flex gap="3">
        <Button size="3" variant="soft" onClick={charges.addRow}>
          {text.addRow}
        </Button>
        <Button size="3" onClick={() => void charges.save()}>
          {text.save}
        </Button>
      </Flex>
    </Flex>
  );
}
