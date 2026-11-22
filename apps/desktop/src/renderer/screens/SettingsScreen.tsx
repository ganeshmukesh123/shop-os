import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, Heading, Separator, Text, TextField } from "@radix-ui/themes";
import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  validateNumberTemplate,
  type BackupStatus,
  type ShopProfile,
} from "@shopos/core";
import { BillSettingsFields } from "../components/BillSettingsFields/BillSettingsFields";
import { isBillSettingsValid } from "../components/BillSettingsFields/billSettingsValidity";
import { useToast } from "../components/Toast";
import { LAYOUT } from "../layout";
import { StatusMessage } from "../shared/components/StatusMessage/StatusMessage";
import { ThemePicker } from "../shared/theme/ThemePicker";
import { useThemePreference } from "../shared/theme/useThemePreference";
import { uiText } from "../strings";
import { call, messageOf } from "../state/api";

const field = (label: string, node: React.ReactNode, help?: string) => (
  <label>
    <Text as="div" size="2" weight="bold" mb="1">
      {label}
    </Text>
    {node}
    {help && (
      <Text as="div" size="1" color="gray" mt="1">
        {help}
      </Text>
    )}
  </label>
);

export function SettingsScreen() {
  const toast = useToast();
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const [shopProfile, setP] = useState<ShopProfile | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setP(await call("settings.get", {}));
    setStatus(await call("backup.status", {}));
  }, []);
  useEffect(() => {
    refresh().catch((caughtError) => toast("error", messageOf(caughtError)));
  }, [refresh, toast]);
  if (!shopProfile) return <Text>{uiText.common.loading}…</Text>;

  // The preview's financial year follows the shop's zone; an unfinished zone name must not break it.
  const previewZone = isValidTimeZone(shopProfile.timeZone)
    ? shopProfile.timeZone
    : DEFAULT_TIME_ZONE;
  const tpl = validateNumberTemplate(
    shopProfile.numberTemplate,
    shopProfile.seriesCode,
    new Date(),
    previewZone,
  );
  const set = (patch: Partial<ShopProfile>) => setP({ ...shopProfile, ...patch });

  async function save(next = shopProfile!) {
    try {
      setP(await call("settings.update", next));
      toast("success", uiText.settings.saved);
      setStatus(await call("backup.status", {}));
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    }
  }

  async function chooseFolder() {
    const { path } = await call("system.pickFolder", {});
    if (path) {
      const next = { ...shopProfile!, backupFolder: path };
      setP(next);
      await save(next);
    }
  }

  async function runNow() {
    setBusy(true);
    try {
      await call("backup.run", {});
      toast("success", uiText.settings.backupOk);
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setBusy(false);
      setStatus(await call("backup.status", {}));
    }
  }

  async function restore() {
    const { path } = await call("system.pickBackupFile", {});
    if (!path) return;
    try {
      // The owner sees the next bill number before anything is replaced (FR-013b).
      const preview = await call("backup.planRestore", { filePath: path });
      const question = `${uiText.settings.restoreConfirm}\n\n${uiText.settings.restoreNextBill} ${preview.nextBillNo}`;
      const isConfirmed = window.confirm(question);
      if (isConfirmed === false) return;
      await call("backup.restore", { filePath: path, confirmedNextBillNo: preview.nextBillNo });
      toast("success", "Restoring… the app will restart.");
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    }
  }

  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageNarrow}>
      <Heading size="6">{uiText.settings.title}</Heading>
      <Heading size="3">{uiText.settings.shop}</Heading>
      {field(
        uiText.settings.name,
        <TextField.Root
          size="3"
          maxLength={80}
          value={shopProfile.name}
          onChange={(changeEvent) => set({ name: changeEvent.target.value })}
        />,
      )}
      {field(
        uiText.settings.address,
        <TextField.Root
          size="3"
          maxLength={200}
          value={shopProfile.address}
          onChange={(changeEvent) => set({ address: changeEvent.target.value })}
        />,
      )}
      {field(
        uiText.settings.phone,
        <TextField.Root
          size="3"
          maxLength={20}
          value={shopProfile.phone}
          onChange={(changeEvent) => set({ phone: changeEvent.target.value })}
        />,
      )}
      <Flex gap="3">
        <Box width={LAYOUT.seriesFieldWidth}>
          {field(
            uiText.settings.series,
            <TextField.Root
              size="3"
              maxLength={8}
              value={shopProfile.seriesCode}
              onChange={(changeEvent) => set({ seriesCode: changeEvent.target.value })}
            />,
          )}
        </Box>
        <Box flexGrow="1">
          {field(
            uiText.settings.template,
            <TextField.Root
              size="3"
              maxLength={40}
              value={shopProfile.numberTemplate}
              onChange={(changeEvent) => set({ numberTemplate: changeEvent.target.value })}
            />,
            uiText.settings.templateHelp,
          )}
        </Box>
      </Flex>
      {tpl.ok ? (
        <Text size="2">
          {uiText.settings.preview}: <b>{tpl.example}</b>
        </Text>
      ) : (
        <StatusMessage role="danger" label={uiText.status.error}>
          {tpl.reason}
        </StatusMessage>
      )}
      {field(
        uiText.settings.footer,
        <TextField.Root
          size="3"
          maxLength={200}
          value={shopProfile.footer}
          onChange={(changeEvent) => set({ footer: changeEvent.target.value })}
        />,
      )}
      <BillSettingsFields settings={shopProfile} onChange={set} />
      <Flex>
        <Button
          size="3"
          onClick={() => void save()}
          disabled={!tpl.ok || !shopProfile.name.trim() || !isBillSettingsValid(shopProfile)}
        >
          {uiText.settings.save}
        </Button>
      </Flex>

      <Separator size="4" my="3" />
      <Heading size="3">{uiText.settings.backup}</Heading>
      {field(
        uiText.settings.backupFolder,
        <Flex gap="2">
          <Box flexGrow="1">
            <TextField.Root
              size="3"
              readOnly
              value={shopProfile.backupFolder}
              placeholder="No folder chosen"
            />
          </Box>
          <Button size="3" variant="soft" onClick={() => void chooseFolder()}>
            {uiText.settings.choose}
          </Button>
        </Flex>,
      )}
      <Text size="2">
        {uiText.settings.lastBackup}:{" "}
        <b>
          {status?.lastOkAt ? new Date(status.lastOkAt).toLocaleString() : uiText.settings.never}
        </b>
      </Text>
      {status?.lastError && (
        <StatusMessage role="danger" label={uiText.settings.backupFailed}>
          {status.lastError}
        </StatusMessage>
      )}
      <Flex gap="3">
        <Button
          size="3"
          onClick={() => void runNow()}
          loading={busy}
          disabled={!shopProfile.backupFolder}
        >
          {uiText.settings.runNow}
        </Button>
        <Button size="3" variant="soft" color="gray" onClick={() => void restore()}>
          {uiText.settings.restore}
        </Button>
      </Flex>

      <Separator size="4" my="3" />
      <Heading size="3">{uiText.theme.title}</Heading>
      <ThemePicker preference={themePreference} onChange={setThemePreference} />
    </Flex>
  );
}
