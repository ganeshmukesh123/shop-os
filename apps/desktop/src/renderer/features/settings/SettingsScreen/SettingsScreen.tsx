import { Button, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { LAYOUT } from "../../../shared/constants/layout";
import { ThemePicker } from "../../../shared/theme/ThemePicker";
import { useThemePreference } from "../../../shared/theme/useThemePreference";
import { uiText } from "../../../shared/text/strings";
import { BackupSection } from "./components/BackupSection/BackupSection";
import { BillSettingsFields } from "./components/BillSettingsFields/BillSettingsFields";
import { isBillSettingsValid } from "./components/BillSettingsFields/billSettingsValidity";
import { RestoreBackupDialog } from "./components/RestoreBackupDialog/RestoreBackupDialog";
import { useRestoreBackup } from "./components/RestoreBackupDialog/useRestoreBackup";
import { ShopProfileFields } from "./components/ShopProfileFields/ShopProfileFields";
import { checkNumberTemplate } from "./numberTemplateCheck";
import { useSettingsScreen } from "./useSettingsScreen";

export function SettingsScreen() {
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const settings = useSettingsScreen();
  const { shopProfile } = settings;
  const restoreBackup = useRestoreBackup(shopProfile, settings.toast);
  if (!shopProfile) return <Text>{uiText.common.loading}…</Text>;

  const templateCheck = checkNumberTemplate(shopProfile, new Date());
  const canSave = templateCheck.ok && !!shopProfile.name.trim() && isBillSettingsValid(shopProfile);

  return (
    <Flex direction="column" gap="3" maxWidth={LAYOUT.pageNarrow}>
      <Heading size="6">{uiText.settings.title}</Heading>
      <Heading size="3">{uiText.settings.shop}</Heading>
      <ShopProfileFields
        profile={shopProfile}
        templateCheck={templateCheck}
        onChange={settings.change}
      />
      <BillSettingsFields settings={shopProfile} onChange={settings.change} />
      <Flex>
        <Button size="3" onClick={() => void settings.save(shopProfile)} disabled={!canSave}>
          {uiText.settings.save}
        </Button>
      </Flex>

      <Separator size="4" my="3" />
      <Heading size="3">{uiText.settings.backup}</Heading>
      <BackupSection
        backupFolder={shopProfile.backupFolder}
        status={settings.status}
        isBackingUp={settings.isBackingUp}
        onChooseFolder={() => void settings.chooseFolder(shopProfile)}
        onBackUpNow={() => void settings.backUpNow()}
        onRestore={() => void restoreBackup.start()}
      />

      <Separator size="4" my="3" />
      <Heading size="3">{uiText.theme.title}</Heading>
      <ThemePicker preference={themePreference} onChange={setThemePreference} />
      <RestoreBackupDialog {...restoreBackup.dialog} />
    </Flex>
  );
}
