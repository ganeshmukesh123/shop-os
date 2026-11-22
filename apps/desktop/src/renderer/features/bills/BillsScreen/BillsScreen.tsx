import { useState } from "react";
import { Flex, Heading, Text } from "@radix-ui/themes";
import { StatusMessage } from "../../../shared/components/StatusMessage/StatusMessage";
import { LAYOUT } from "../../../shared/constants/layout";
import { fillText } from "../../../shared/text/fillText";
import { uiText } from "../../../shared/text/strings";
import { BillsFilters } from "./components/BillsFilters";
import { BillsTable } from "./components/BillsTable";
import { BILLS_PAGE_LIMIT } from "./constants";
import { useBills } from "./hooks/useBills";
import type { IBillFilter } from "./types";

const NO_FILTER: IBillFilter = { number: "", from: "", to: "", customer: "" };

/** Past bills, newest first, searchable by number, date range and customer (spec US3, FR-016). */
export function BillsScreen() {
  const [filter, setFilter] = useState<IBillFilter>(NO_FILTER);
  const { bills, total, loading, error } = useBills(filter);
  const isFiltered = Object.values(filter).some((fieldValue) => fieldValue !== "");
  const countTemplate = total > BILLS_PAGE_LIMIT ? uiText.bills.countMore : uiText.bills.countOther;
  const countText = fillText(total === 1 ? uiText.bills.countOne : countTemplate, {
    count: total,
    shown: BILLS_PAGE_LIMIT,
  });
  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageWide}>
      <Heading size="6">{uiText.bills.title}</Heading>
      <BillsFilters filter={filter} onChange={setFilter} />
      <Text size="2" color="gray">
        {countText}
      </Text>
      {error && (
        <StatusMessage role="danger" label={uiText.status.error}>
          {error}
        </StatusMessage>
      )}
      <BillsTable bills={bills} />
      {!loading && !error && bills.length === 0 && (
        <Text color="gray">{isFiltered ? uiText.bills.noMatch : uiText.bills.empty}</Text>
      )}
    </Flex>
  );
}
