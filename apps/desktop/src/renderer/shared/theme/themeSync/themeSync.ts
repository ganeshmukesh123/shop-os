import type { IThemeSyncInput, IThemeSyncPlan } from "./types";

/**
 * What to do once the database answers (spec 018 T035). A saved choice wins. With none saved yet,
 * the choice this page already showed (its localStorage cache) is copied in, once.
 */
export function planThemeSync(syncInput: IThemeSyncInput): IThemeSyncPlan {
  const { savedTheme, cachedPreference } = syncInput;
  const hasSavedTheme = savedTheme !== null;
  return hasSavedTheme
    ? { preferenceToShow: savedTheme, preferenceToCopy: undefined }
    : { preferenceToShow: cachedPreference, preferenceToCopy: cachedPreference };
}
