import { Box, Button, Flex, SegmentedControl, Select, Text, TextField } from "@radix-ui/themes";
import { formatRupees, PAYMENT_MODES, type PaymentMode } from "@shopos/core";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { LAYOUT } from "../../../../../shared/constants/layout";
import { uiText } from "../../../../../shared/text/strings";
import { isEmptyForm } from "../../../billForm";
import type { IBillSummaryPanelProps } from "./types";

/** Customer, payment, discount, the totals, and the Clear and Save buttons. */
export function BillSummaryPanel({
  form,
  evaluation,
  isSaving,
  onFormChange,
  onDraftChange,
  onClear,
  onSave,
}: IBillSummaryPanelProps) {
  return (
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
            onChange={(changeEvent) => onFormChange({ customerName: changeEvent.target.value })}
          />
        </label>
        <div>
          <Text as="div" size="2" weight="bold" mb="1" id="pay-label">
            {uiText.bill.payment}
          </Text>
          <Select.Root
            value={form.paymentMode}
            onValueChange={(selectedPaymentMode) =>
              onFormChange({ paymentMode: selectedPaymentMode as PaymentMode })
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
          {uiText.bill.total}: <b>{formatRupees(evaluation.linesTotalPaise)}</b>
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
              onChange={(changeEvent) => onDraftChange({ billDisc: changeEvent.target.value })}
            />
          </Box>
          <SegmentedControl.Root
            size="2"
            value={form.draft.billDiscMode}
            onValueChange={(selectedDiscountMode) =>
              onDraftChange({ billDiscMode: selectedDiscountMode as "rupees" | "percent" })
            }
            aria-label="Bill discount type"
          >
            <SegmentedControl.Item value="rupees">₹</SegmentedControl.Item>
            <SegmentedControl.Item value="percent">%</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>
        {evaluation.billDiscountPaise > 0 && (
          <Text>-{formatRupees(evaluation.billDiscountPaise)}</Text>
        )}
        <Text size="7" weight="bold" aria-live="polite">
          {uiText.bill.grandTotal}: {formatRupees(evaluation.grandTotalPaise)}
        </Text>
        {evaluation.errors
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
            onClick={onClear}
          >
            {uiText.bill.clear}
          </Button>
          <Button size="4" onClick={onSave} loading={isSaving} disabled={!evaluation.valid}>
            {uiText.bill.save} (Ctrl+S)
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}
