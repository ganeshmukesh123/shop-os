import { Box, Flex, TextField } from "@radix-ui/themes";
import { LAYOUT } from "../../../../../shared/constants/layout";
import { uiText } from "../../../../../shared/text/strings";
import type { IBillFilter } from "../../types";
import type { IBillsFiltersProps } from "./types";

/** The four ways to find a bill (FR-016): its number, a date range and the customer's name. */
export function BillsFilters({ filter, onChange }: IBillsFiltersProps) {
  const field = (fieldName: keyof IBillFilter, label: string, type: "text" | "date" = "text") => (
    <Box width={LAYOUT.billFilterFieldWidth}>
      <TextField.Root
        size="3"
        type={type}
        aria-label={label}
        placeholder={type === "text" ? label : undefined}
        value={filter[fieldName]}
        onChange={(changeEvent) => onChange({ ...filter, [fieldName]: changeEvent.target.value })}
      />
    </Box>
  );
  return (
    <Flex gap="3" wrap="wrap" align="center">
      {field("number", uiText.bills.number)}
      {field("from", uiText.bills.from, "date")}
      {field("to", uiText.bills.to, "date")}
      {field("customer", uiText.bills.customer)}
    </Flex>
  );
}
