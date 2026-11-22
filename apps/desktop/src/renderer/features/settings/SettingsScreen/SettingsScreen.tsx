import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  RadioGroup,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { validateNumberTemplate, type BackupStatus, type ShopProfile } from "@shopos/core";
import { useToast } from "../../../shared/components/Toast";
import { LAYOUT } from "../../../shared/constants/layout";
import { StatusMessage } from "../../../shared/components/StatusMessage/StatusMessage";
import { ThemePicker } from "../../../shared/theme/ThemePicker";
import { useThemePreference } from "../../../shared/theme/useThemePreference";
import { uiText } from "../../../shared/text/strings";
import { call, messageOf } from "../../../shared/api/api";

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

  const tpl = validateNumberTemplate(shopProfile.numberTemplate, shopProfile.seriesCode);
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
    if (!window.confirm(uiText.settings.restoreConfirm)) return;
    try {
      await call("backup.restore", { filePath: path });
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
      <div>
        <Text as="div" size="2" weight="bold" mb="1" id="width-label">
          {uiText.settings.width}
        </Text>
        <RadioGroup.Root
          aria-labelledby="width-label"
          value={shopProfile.receiptWidth}
          onValueChange={(selectedReceiptWidth) =>
            set({ receiptWidth: selectedReceiptWidth as "58mm" | "80mm" })
          }
        >
          <RadioGroup.Item value="80mm">80 mm</RadioGroup.Item>
          <RadioGroup.Item value="58mm">58 mm</RadioGroup.Item>
        </RadioGroup.Root>
      </div>
      <Flex>
        <Button size="3" onClick={() => void save()} disabled={!tpl.ok || !shopProfile.name.trim()}>
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
