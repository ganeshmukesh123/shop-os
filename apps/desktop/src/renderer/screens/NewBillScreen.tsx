import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  evaluateDraft,
  formatQuantity,
  formatRupees,
  paiseToInput,
  PAYMENT_MODES,
  type Bill,
  type BillLine,
  type DraftLine,
  type Item,
  type PaymentMode,
} from "@shopos/core";
import { BillLineRow } from "../components/BillLineRow";
import { RoundOffLine } from "../components/RoundOffLine/RoundOffLine";
import { useRoundedTotal } from "../components/RoundOffLine/useRoundedTotal";
import { useToast } from "../components/Toast";
import { LAYOUT } from "../layout";
import { StatusMessage } from "../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../strings";
import { call, messageOf } from "../state/api";
import {
  emptyForm,
  isEmptyForm,
  loadDraftForm,
  useDraftAutosave,
  type BillForm,
} from "../state/billDraft";
import { BillView } from "./BillView";

interface Saved {
  bill: Bill;
  lines: BillLine[];
  negativeStockItems: Item[];
}

export function NewBillScreen() {
  const toast = useToast();
  const [form, setForm] = useState<BillForm>(emptyForm());
  const [ready, setReady] = useState(false);
  const [recover, setRecover] = useState<BillForm | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Item[]>([]);
  const [hi, setHi] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const focusLine = useRef<string | null>(null);

  useEffect(() => {
    loadDraftForm()
      .then((savedForm) => savedForm && setRecover(savedForm))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useDraftAutosave(form, ready && !saved && !recover);

  // Search as the user types (2+ characters), keeping only the latest response.
  useEffect(() => {
    if (query.trim().length < 2) {
      setMatches([]);
      return;
    }
    let live = true;
    call("items.list", { query: query.trim(), limit: 8, offset: 0 })
      .then((listResult) => {
        if (live) {
          setMatches(listResult.items);
          setHi(0);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [query]);

  useEffect(() => {
    if (focusLine.current) {
      const el = qtyRefs.current.get(focusLine.current);
      if (el) {
        el.focus();
        el.select();
        focusLine.current = null;
      }
    }
  });

  const ev = useMemo(() => evaluateDraft(form.draft), [form.draft]);
  const roundedTotal = useRoundedTotal(ev.grandTotalPaise);

  const setDraft = (patch: Partial<BillForm["draft"]>) =>
    setForm((previousForm) => ({ ...previousForm, draft: { ...previousForm.draft, ...patch } }));
  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    setDraft({
      lines: form.draft.lines.map((draftLine) =>
        draftLine.key === key ? { ...draftLine, ...patch } : draftLine,
      ),
    });

  const addItem = useCallback((it: Item) => {
    setForm((previousForm) => {
      const existing = previousForm.draft.lines.find((draftLine) => draftLine.itemId === it.id);
      if (existing) {
        focusLine.current = existing.key;
        const existingQuantity = Number(existing.qty);
        const next = Number.isFinite(existingQuantity) ? String(existingQuantity + 1) : "1";
        return {
          ...previousForm,
          draft: {
            ...previousForm.draft,
            lines: previousForm.draft.lines.map((draftLine) =>
              draftLine.key === existing.key ? { ...draftLine, qty: next } : draftLine,
            ),
          },
        };
      }
      const key = crypto.randomUUID();
      focusLine.current = key;
      const line: DraftLine = {
        key,
        itemId: it.id,
        name: it.name,
        unit: it.unit,
        allowsDecimal: it.allowsDecimal,
        qty: "1",
        rate: paiseToInput(it.pricePaise),
        disc: "",
        discMode: "rupees",
      };
      return {
        ...previousForm,
        draft: { ...previousForm.draft, lines: [...previousForm.draft.lines, line] },
      };
    });
    setQuery("");
    setMatches([]);
  }, []);

  const save = useCallback(async () => {
    if (!ev.valid || !ev.input || saving) {
      if (!ev.valid) toast("error", ev.errors[0] ?? "Check the bill");
      return;
    }
    setSaving(true);
    try {
      const saveResult = await call("bills.save", {
        clientBillId: form.clientBillId,
        customerName: form.customerName.trim() || undefined,
        paymentMode: form.paymentMode,
        billDiscountPaise: ev.billDiscountPaise,
        lines: ev.input.map(({ itemId, quantityMilli, ratePaise, lineDiscountPaise }) => ({
          itemId,
          quantityMilli,
          ratePaise,
          lineDiscountPaise,
        })),
      });
      setSaved(saveResult);
      setForm(emptyForm());
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setSaving(false);
    }
  }, [ev, form, saving, toast]);

  // Ctrl/Cmd+S saves the bill.
  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (
        (keyboardEvent.ctrlKey || keyboardEvent.metaKey) &&
        keyboardEvent.key.toLowerCase() === "s"
      ) {
        keyboardEvent.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  useEffect(() => {
    if (!saved && ready) searchRef.current?.focus();
  }, [saved, ready]);

  if (saved) {
    return (
      <BillView
        bill={saved.bill}
        lines={saved.lines}
        negativeStockItems={saved.negativeStockItems}
        onNew={() => setSaved(null)}
      />
    );
  }

  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageWide}>
      <Heading size="6">{uiText.bill.title}</Heading>

      <Box position="relative">
        <TextField.Root
          ref={searchRef}
          size="3"
          autoFocus
          placeholder={uiText.bill.search}
          aria-label={uiText.bill.search}
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          onKeyDown={(keyboardEvent) => {
            if (keyboardEvent.key === "ArrowDown") {
              keyboardEvent.preventDefault();
              setHi((previousHighlight) => Math.min(previousHighlight + 1, matches.length - 1));
            } else if (keyboardEvent.key === "ArrowUp") {
              keyboardEvent.preventDefault();
              setHi((previousHighlight) => Math.max(previousHighlight - 1, 0));
            } else if (keyboardEvent.key === "Enter" && matches[hi]) {
              keyboardEvent.preventDefault();
              addItem(matches[hi]!);
            } else if (keyboardEvent.key === "Escape") {
              setQuery("");
            }
          }}
        />
        {query.trim().length >= 2 && (
          <ul role="listbox" aria-label="Matching items" className="shopos-search-results">
            {matches.length === 0 && (
              <li className="shopos-search-empty">
                <Text color="gray">{uiText.bill.noMatch}</Text>
              </li>
            )}
            {matches.map((matchingItem, listIndex) => (
              <li
                key={matchingItem.id}
                role="option"
                aria-selected={listIndex === hi}
                onMouseDown={(mouseEvent) => {
                  mouseEvent.preventDefault();
                  addItem(matchingItem);
                }}
                onMouseEnter={() => setHi(listIndex)}
                className="shopos-search-result"
              >
                <span>
                  {matchingItem.name}{" "}
                  <Text color="gray" size="2">
                    ({matchingItem.unit})
                  </Text>
                </span>
                <span>
                  {formatRupees(matchingItem.pricePaise)} · stock{" "}
                  {formatQuantity(matchingItem.stockMilli)}
                  {matchingItem.needsCorrection ? " (negative)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Box>

      {form.draft.lines.length === 0 ? (
        <Text color="gray">{uiText.bill.empty}</Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>{uiText.bill.item}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{uiText.bill.qty}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{uiText.bill.rate}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{uiText.bill.discount}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell justify="end">{uiText.bill.amount}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {form.draft.lines.map((draftLine, listIndex) => (
              <BillLineRow
                key={draftLine.key}
                line={draftLine}
                result={ev.lines[listIndex]!}
                ref={(el) => {
                  if (el) qtyRefs.current.set(draftLine.key, el);
                  else qtyRefs.current.delete(draftLine.key);
                }}
                onChange={(linePatch) => patchLine(draftLine.key, linePatch)}
                onRemove={() =>
                  setDraft({
                    lines: form.draft.lines.filter((otherLine) => otherLine.key !== draftLine.key),
                  })
                }
                onEnterQty={() => searchRef.current?.focus()}
              />
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <Flex gap="4" wrap="wrap" align="start">
        <Flex direction="column" gap="3" flexGrow="1" minWidth={LAYOUT.formColumnMinWidth}>
          <label>
            <Text as="div" size="2" weight="bold" mb="1">
              {uiText.bill.customerName}
            </Text>
            <TextField.Root
              size="3"
              maxLength={80}
              value={form.customerName}
              onChange={(changeEvent) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  customerName: changeEvent.target.value,
                }))
              }
            />
          </label>
          <div>
            <Text as="div" size="2" weight="bold" mb="1" id="pay-label">
              {uiText.bill.payment}
            </Text>
            <Select.Root
              value={form.paymentMode}
              onValueChange={(selectedPaymentMode) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  paymentMode: selectedPaymentMode as PaymentMode,
                }))
              }
            >
              <Select.Trigger aria-labelledby="pay-label" className="shopos-payment-select" />
              <Select.Content>
                {PAYMENT_MODES.map((paymentMode) => (
                  <Select.Item key={paymentMode} value={paymentMode}>
                    {uiText.payment[paymentMode]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        </Flex>
        <Flex direction="column" gap="2" align="end" minWidth={LAYOUT.formColumnMinWidth}>
          <Text>
            {uiText.bill.total}: <b>{formatRupees(ev.linesTotalPaise)}</b>
          </Text>
          <Flex gap="2" align="center">
            <Text size="2" weight="bold">
              {uiText.bill.billDiscount}
            </Text>
            <Box width={LAYOUT.discountFieldWidth}>
              <TextField.Root
                size="3"
                inputMode="decimal"
                aria-label={uiText.bill.billDiscount}
                value={form.draft.billDisc}
                onChange={(changeEvent) => setDraft({ billDisc: changeEvent.target.value })}
              />
            </Box>
            <SegmentedControl.Root
              size="2"
              value={form.draft.billDiscMode}
              onValueChange={(selectedDiscountMode) =>
                setDraft({ billDiscMode: selectedDiscountMode as "rupees" | "percent" })
              }
              aria-label="Bill discount type"
            >
              <SegmentedControl.Item value="rupees">₹</SegmentedControl.Item>
              <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          {ev.billDiscountPaise > 0 && <Text>-{formatRupees(ev.billDiscountPaise)}</Text>}
          <RoundOffLine roundOffPaise={roundedTotal.roundOffPaise} />
          <Text size="7" weight="bold" aria-live="polite">
            {uiText.bill.grandTotal}: {formatRupees(roundedTotal.roundedTotalPaise)}
          </Text>
          {ev.errors
            .filter(
              (errorMessage) => !errorMessage.startsWith("Fix") && !errorMessage.startsWith("Add"),
            )
            .map((errorMessage) => (
              <StatusMessage key={errorMessage} role="danger" label={uiText.status.error}>
                {errorMessage}
              </StatusMessage>
            ))}
          <Flex gap="3">
            <Button
              size="3"
              variant="soft"
              color="gray"
              disabled={isEmptyForm(form)}
              onClick={() => setForm(emptyForm())}
            >
              {uiText.bill.clear}
            </Button>
            <Button size="4" onClick={() => void save()} loading={saving} disabled={!ev.valid}>
              {uiText.bill.save} (Ctrl+S)
            </Button>
          </Flex>
        </Flex>
      </Flex>

      {recover && (
        <Dialog.Root open>
          <Dialog.Content maxWidth="440px">
            <Dialog.Title>{uiText.bill.recoverTitle}</Dialog.Title>
            <Dialog.Description>{uiText.bill.recoverBody}</Dialog.Description>
            <Box mt="3">
              <StatusMessage role="neutral" label={uiText.status.draft}>
                {recover.draft.lines.length} line{recover.draft.lines.length === 1 ? "" : "s"}:{" "}
                {recover.draft.lines.map((draftLine) => draftLine.name).join(", ")}
              </StatusMessage>
            </Box>
            <Flex gap="3" mt="4" justify="end">
              <Button
                variant="soft"
                color="gray"
                size="3"
                onClick={() => {
                  setRecover(null);
                  void call("bills.draft.save", { payload: null });
                }}
              >
                {uiText.bill.discard}
              </Button>
              <Button
                size="3"
                autoFocus
                onClick={() => {
                  setForm({
                    ...recover,
                    clientBillId: recover.clientBillId ?? crypto.randomUUID(),
                  });
                  setRecover(null);
                }}
              >
                {uiText.bill.recover}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Flex>
  );
}
