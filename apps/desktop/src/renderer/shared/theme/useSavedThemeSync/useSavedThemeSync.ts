import { useEffect } from "react";
import { planThemeSync } from "../themeSync/themeSync";
import type { IThemeStore, ThemePreference } from "../types";
import type { ISavedThemeSyncOptions } from "./types";

/**
 * Once, after the first paint: read the choice from the database and show it, or copy the page's
 * cached choice into the database when none is saved yet (spec 018 T035). A choice the user makes
 * before the database answers wins. A failed read or write keeps the cached choice on screen.
 */
export function useSavedThemeSync(options: ISavedThemeSyncOptions): void {
  const { themeStore, cachedPreference, applyPreference, hasUserChosen } = options;
  useEffect(() => {
    let isActive = true;
    const applySavedTheme = (savedTheme: ThemePreference | null) => {
      const isStillWanted = isActive && !hasUserChosen();
      if (isStillWanted) {
        const syncPlan = planThemeSync({ savedTheme, cachedPreference });
        applyPreference(syncPlan.preferenceToShow);
        void copyWhenNeeded(themeStore, syncPlan.preferenceToCopy);
      }
    };
    themeStore.load().then(applySavedTheme, () => {});
    return () => {
      isActive = false;
    };
    // Empty on purpose: runs once per mount, against the choice the first paint showed.
  }, []);
}

async function copyWhenNeeded(
  themeStore: IThemeStore,
  preferenceToCopy: ThemePreference | undefined,
): Promise<void> {
  const isCopyNeeded = preferenceToCopy !== undefined;
  if (isCopyNeeded) {
    await themeStore.save(preferenceToCopy).catch(() => {});
  }
}
