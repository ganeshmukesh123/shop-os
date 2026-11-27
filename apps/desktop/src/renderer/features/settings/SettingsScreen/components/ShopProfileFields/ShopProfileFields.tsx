import { Box, Flex, Text } from "@radix-ui/themes";
import { LAYOUT } from "../../../../../shared/constants/layout";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import { ProfileTextField } from "../ProfileTextField/ProfileTextField";
import { TEXT_LIMITS } from "./ShopProfileFields.constants";
import type { IShopProfileFieldsProps } from "./ShopProfileFields.types";

/** The shop's name, contact details, bill-number format and bill footer, with the number preview. */
export function ShopProfileFields({ profile, templateCheck, onChange }: IShopProfileFieldsProps) {
  const text = uiText.settings;
  return (
    <>
      <ProfileTextField
        label={text.name}
        value={profile.name}
        maxLength={TEXT_LIMITS.name}
        onTextChange={(name) => onChange({ name })}
      />
      <ProfileTextField
        label={text.address}
        value={profile.address}
        maxLength={TEXT_LIMITS.address}
        onTextChange={(address) => onChange({ address })}
      />
      <ProfileTextField
        label={text.phone}
        value={profile.phone}
        maxLength={TEXT_LIMITS.phone}
        onTextChange={(phone) => onChange({ phone })}
      />
      <Flex gap="3">
        <Box width={LAYOUT.seriesFieldWidth}>
          <ProfileTextField
            label={text.series}
            value={profile.seriesCode}
            maxLength={TEXT_LIMITS.series}
            onTextChange={(seriesCode) => onChange({ seriesCode })}
          />
        </Box>
        <Box flexGrow="1">
          <ProfileTextField
            label={text.template}
            help={text.templateHelp}
            value={profile.numberTemplate}
            maxLength={TEXT_LIMITS.template}
            onTextChange={(numberTemplate) => onChange({ numberTemplate })}
          />
        </Box>
      </Flex>
      {templateCheck.ok ? (
        <Text size="2">
          {text.preview}: <b>{templateCheck.example}</b>
        </Text>
      ) : (
        <StatusMessage role="danger" label={uiText.status.error}>
          {templateCheck.reason}
        </StatusMessage>
      )}
      <ProfileTextField
        label={text.footer}
        value={profile.footer}
        maxLength={TEXT_LIMITS.footer}
        onTextChange={(footer) => onChange({ footer })}
      />
    </>
  );
}
