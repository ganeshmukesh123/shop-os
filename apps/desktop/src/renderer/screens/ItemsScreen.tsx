import { useState } from "react";
import { Badge, Button, Checkbox, Flex, Heading, Table, Text, TextField } from "@radix-ui/themes";
import { formatQuantity, formatRupees, type Item } from "@shopos/core";
import { AdjustStockDialog } from "../components/AdjustStockDialog";
import { useToast } from "../components/Toast";
import { uiText } from "../strings";
import { call, messageOf } from "../state/api";
import { useItems } from "../state/items";
import { ItemForm } from "./ItemForm";

export function ItemsScreen() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const { items, total, loading, reload } = useItems({ query, includeInactive, needsCorrection });
  const [form, setForm] = useState<{ item?: Item } | null>(null);
  const [adjusting, setAdjusting] = useState<Item | null>(null);

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
        <Button size="3" onClick={() => setForm({})}>
          {uiText.items.add}
        </Button>
      </Flex>
      <Flex gap="4" align="center" wrap="wrap">
        <TextField.Root
          size="3"
          style={{ width: 360 }}
          placeholder={uiText.items.search}
          aria-label={uiText.items.search}
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
        />
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
            <Table.Row key={it.id} style={it.active ? undefined : { opacity: 0.65 }}>
              <Table.RowHeaderCell>{it.name}</Table.RowHeaderCell>
              <Table.Cell>{it.unit}</Table.Cell>
              <Table.Cell justify="end">{formatRupees(it.pricePaise)}</Table.Cell>
              <Table.Cell justify="end">{formatQuantity(it.stockMilli)}</Table.Cell>
              <Table.Cell>
                {it.needsCorrection && <Badge color="red">{uiText.items.negative}</Badge>}{" "}
                {!it.active && <Badge color="gray">{uiText.items.inactive}</Badge>}
              </Table.Cell>
              <Table.Cell>
                <Flex gap="2" justify="end">
                  <Button size="2" variant="soft" onClick={() => setForm({ item: it })}>
                    {uiText.items.edit}
                  </Button>
                  <Button size="2" variant="soft" onClick={() => setAdjusting(it)}>
                    {uiText.items.adjust}
                  </Button>
                  <Button
                    size="2"
                    variant="soft"
                    color="gray"
                    onClick={() => void toggleActive(it)}
                  >
                    {it.active ? uiText.items.deactivate : uiText.items.reactivate}
                  </Button>
                </Flex>
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
