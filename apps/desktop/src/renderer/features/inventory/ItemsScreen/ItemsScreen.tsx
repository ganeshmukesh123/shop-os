import { useState } from "react";
import { Box, Button, Checkbox, Flex, Heading, Table, Text, TextField } from "@radix-ui/themes";
import { LAYOUT } from "../../../shared/constants/layout";
import { StatusBadge } from "../../../shared/components/StatusBadge/StatusBadge";
import { formatQuantity, formatRupees, type Item } from "@shopos/core";
import { AdjustStockDialog } from "../AdjustStockDialog";
import { useToast } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";
import { call, messageOf } from "../../../shared/api/api";
import { useItems } from "../hooks/useItems";
import { ItemForm } from "../ItemForm";
import { NewFamilyButton } from "../../items/NewFamilyButton";
import { ItemRowActions } from "./components/ItemRowActions";
import { ItemRowDialog, type IItemRowDialog } from "./components/ItemRowDialog";

export function ItemsScreen() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const { items, total, loading, reload } = useItems({ query, includeInactive, needsCorrection });
  const [form, setForm] = useState<{ item?: Item } | null>(null);
  const [adjusting, setAdjusting] = useState<Item | null>(null);
  const [rowDialog, setRowDialog] = useState<IItemRowDialog | null>(null);

  async function toggleActive(it: Item) {
    try {
      await call("items.update", { id: it.id, active: !it.active });
      reload();
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    }
  }

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Heading size="6">{uiText.items.title}</Heading>
        <Flex gap="3">
          <NewFamilyButton
            onSaved={() => reload()}
            onOpenExisting={(duplicate) => setQuery(duplicate.displayName)}
          />
          <Button size="3" onClick={() => setForm({})}>
            {uiText.items.add}
          </Button>
        </Flex>
      </Flex>
      <Flex gap="4" align="center" wrap="wrap">
        <Box width={LAYOUT.searchFieldWidth}>
          <TextField.Root
            size="3"
            placeholder={uiText.items.search}
            aria-label={uiText.items.search}
            value={query}
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          />
        </Box>
        <Text as="label" size="2">
          <Flex gap="2" align="center">
            <Checkbox
              checked={includeInactive}
              onCheckedChange={(checkedState) => setIncludeInactive(checkedState === true)}
            />
            {uiText.items.showInactive}
          </Flex>
        </Text>
        <Text as="label" size="2">
          <Flex gap="2" align="center">
            <Checkbox
              checked={needsCorrection}
              onCheckedChange={(checkedState) => setNeedsCorrection(checkedState === true)}
            />
            {uiText.items.needsCorrection}
          </Flex>
        </Text>
        <Text size="2" color="gray">
          {total} item{total === 1 ? "" : "s"}
        </Text>
      </Flex>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>{uiText.items.name}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{uiText.items.unit}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell justify="end">{uiText.items.price}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell justify="end">{uiText.items.stock}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{uiText.items.status}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((it) => (
            <Table.Row key={it.id} className={it.active ? undefined : "shopos-row-inactive"}>
              <Table.RowHeaderCell>{it.name}</Table.RowHeaderCell>
              <Table.Cell>{it.unit}</Table.Cell>
              <Table.Cell justify="end">{formatRupees(it.pricePaise)}</Table.Cell>
              <Table.Cell justify="end">{formatQuantity(it.stockMilli)}</Table.Cell>
              <Table.Cell>
                {it.needsCorrection && <StatusBadge role="warning" label={uiText.items.negative} />}{" "}
                {!it.active && <StatusBadge role="neutral" label={uiText.items.inactive} />}
              </Table.Cell>
              <Table.Cell>
                <ItemRowActions
                  item={it}
                  onEdit={() => setForm({ item: it })}
                  onAdjust={() => setAdjusting(it)}
                  onUnits={() => setRowDialog({ kind: "units", item: it })}
                  onMerge={() => setRowDialog({ kind: "merge", item: it })}
                  onToggleActive={() => void toggleActive(it)}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {!loading && items.length === 0 && (
        <Text color="gray">
          {query || needsCorrection ? "No items match." : uiText.items.empty}
        </Text>
      )}
      {form && (
        <ItemForm
          item={form.item}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null);
            reload();
          }}
        />
      )}
      {rowDialog && (
        <ItemRowDialog
          dialog={rowDialog}
          onClose={() => setRowDialog(null)}
          onMerged={(survivor) => {
            setRowDialog(null);
            toast("success", uiText.merge.merged.replace("{survivor}", survivor.name));
            reload();
          }}
        />
      )}
      {adjusting && (
        <AdjustStockDialog
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            reload();
          }}
        />
      )}
    </Flex>
  );
}
