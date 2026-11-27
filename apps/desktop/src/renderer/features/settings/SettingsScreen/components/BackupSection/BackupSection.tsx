import { Box, Button, Flex, Text, TextField } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { formatDeviceDateTime } from "../../../../../shared/text/formatDeviceDateTime";
import { uiText } from "../../../../../shared/text/strings";
import { SettingsField } from "../SettingsField/SettingsField";
import type { IBackupSectionProps } from "./BackupSection.types";

/** The backup folder, when the last good backup was, and the Back up now and Restore buttons. */
export function BackupSection({
  backupFolder,
  status,
  isBackingUp,
  onChooseFolder,
  onBackUpNow,
  onRestore,
}: IBackupSectionProps) {
  return (
    <>
      <SettingsField label={uiText.settings.backupFolder}>
        <Flex gap="2">
          <Box flexGrow="1">
            <TextField.Root
              size="3"
              readOnly
              value={backupFolder}
              placeholder={uiText.settings.noFolderChosen}
            />
          </Box>
          <Button size="3" variant="soft" onClick={onChooseFolder}>
            {uiText.settings.choose}
          </Button>
        </Flex>
      </SettingsField>
      <Text size="2">
        {uiText.settings.lastBackup}:{" "}
        <b>{status?.lastOkAt ? formatDeviceDateTime(status.lastOkAt) : uiText.settings.never}</b>
      </Text>
      {status?.lastError && (
        <StatusMessage role="danger" label={uiText.settings.backupFailed}>
          {status.lastError}
        </StatusMessage>
      )}
      <Flex gap="3">
        <Button size="3" onClick={onBackUpNow} loading={isBackingUp} disabled={!backupFolder}>
          {uiText.settings.runNow}
        </Button>
        <Button size="3" variant="soft" color="gray" onClick={onRestore}>
          {uiText.settings.restore}
        </Button>
      </Flex>
    </>
  );
}
