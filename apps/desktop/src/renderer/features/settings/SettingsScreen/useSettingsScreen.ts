import { useCallback, useEffect, useState } from "react";
import type { BackupStatus, ShopProfile } from "@shopos/core";
import { call, messageOf } from "../../../shared/api/api";
import { useToast } from "../../../shared/components/Toast";
import { uiText } from "../../../shared/text/strings";

/** What the Settings screen shows and does: read the profile and backup status, save, back up. */
export function useSettingsScreen() {
  const toast = useToast();
  const [shopProfile, setShopProfile] = useState<ShopProfile | null>(null);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const refresh = useCallback(async () => {
    setShopProfile(await call("settings.get", {}));
    setStatus(await call("backup.status", {}));
  }, []);
  useEffect(() => {
    refresh().catch((caughtError) => toast("error", messageOf(caughtError)));
  }, [refresh, toast]);

  const change = (patch: Partial<ShopProfile>) =>
    setShopProfile((current) => (current ? { ...current, ...patch } : current));

  async function save(profileToSave: ShopProfile) {
    try {
      setShopProfile(await call("settings.update", profileToSave));
      toast("success", uiText.settings.saved);
      setStatus(await call("backup.status", {}));
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    }
  }

  async function chooseFolder(profile: ShopProfile) {
    const { path } = await call("system.pickFolder", {});
    if (!path) return;
    const withFolder = { ...profile, backupFolder: path };
    setShopProfile(withFolder);
    await save(withFolder);
  }

  async function backUpNow() {
    setIsBackingUp(true);
    try {
      await call("backup.run", {});
      toast("success", uiText.settings.backupOk);
    } catch (caughtError) {
      toast("error", messageOf(caughtError));
    } finally {
      setIsBackingUp(false);
      setStatus(await call("backup.status", {}));
    }
  }

  return { toast, shopProfile, status, isBackingUp, change, save, chooseFolder, backUpNow };
}
