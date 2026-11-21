import { Flex, RadioGroup, Switch, Text, TextField } from "@radix-ui/themes";
import { isValidTimeZone, type ReceiptWidth } from "@shopos/core";
import { StatusMessage } from "../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../strings";
import { DOC_TITLE_MAX_LENGTH, PAPER_CHOICES } from "./BillSettingsFields.constants";
import type { IBillSettingsFieldsProps } from "./BillSettingsFields.types";

/** The settings that shape every bill (FR-010a, FR-015a, FR-019a). Pure: the screen owns the state. */
export function BillSettingsFields({ settings, onChange }: IBillSettingsFieldsProps) {
  const text = uiText.settings;
  return (
    <Flex direction="column" gap="3">
      <div>
        <Text as="div" size="2" weight="bold" mb="1">
          <label htmlFor="bill-doc-title">{text.docTitle}</label>
        </Text>
        <TextField.Root
          id="bill-doc-title"
          required
          aria-describedby="bill-doc-title-help"
          size="3"
          maxLength={DOC_TITLE_MAX_LENGTH}
          value={settings.docTitle}
          onChange={(changeEvent) => onChange({ docTitle: changeEvent.target.value })}
        />
        <Text as="div" id="bill-doc-title-help" size="1" color="gray" mt="1">
          {text.docTitleHelp}
        </Text>
      </div>

      <div>
        <Text as="label" size="2" weight="bold">
          <Flex gap="2" align="center">
            <Switch
              size="3"
              checked={settings.roundBillTotal}
              onCheckedChange={(isOn) => onChange({ roundBillTotal: isOn })}
            />
            {text.roundTotal}
          </Flex>
        </Text>
        <Text as="div" size="1" color="gray" mt="1">
          {text.roundTotalHelp}
        </Text>
      </div>

      <div>
        <Text as="div" size="2" weight="bold" mb="1">
          <label htmlFor="bill-time-zone">{text.timeZone}</label>
        </Text>
        <TextField.Root
          id="bill-time-zone"
          required
          aria-describedby="bill-time-zone-help"
          size="3"
          maxLength={64}
          value={settings.timeZone}
          onChange={(changeEvent) => onChange({ timeZone: changeEvent.target.value })}
        />
        <Text as="div" id="bill-time-zone-help" size="1" color="gray" mt="1">
          {text.timeZoneHelp}
        </Text>
      </div>
      {!isValidTimeZone(settings.timeZone) && (
        <StatusMessage role="danger" label={uiText.status.error}>
          {text.timeZoneUnknown}
        </StatusMessage>
      )}

      <div>
        <Text as="div" size="2" weight="bold" mb="1" id="paper-label">
          {text.width}
        </Text>
        <RadioGroup.Root
          aria-labelledby="paper-label"
          value={settings.receiptWidth}
          onValueChange={(chosenPaper) => onChange({ receiptWidth: chosenPaper as ReceiptWidth })}
        >
          {PAPER_CHOICES.map((paper) => (
            <RadioGroup.Item key={paper} value={paper}>
              {text.paper[paper]}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>
    </Flex>
  );
}
