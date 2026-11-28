import { Button, Flex, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import type { IChargeRowProps } from "./types";

/** One pack size and its charge, as typed (spec 002 T066). */
export function ChargeRow({ row, onChange, onRemove }: IChargeRowProps) {
  const text = uiText.tinting.charges;
  return (
    <Flex gap="3" align="center">
      <TextField.Root
        aria-label={text.packSize}
        inputMode="decimal"
        value={row.sizeText}
        onChange={(event) => onChange({ sizeText: event.target.value })}
      />
      <TextField.Root
        aria-label={text.charge}
        inputMode="decimal"
        value={row.chargeText}
        onChange={(event) => onChange({ chargeText: event.target.value })}
      />
      <Button size="2" variant="ghost" color="gray" onClick={onRemove}>
        {text.remove}
      </Button>
    </Flex>
  );
}
