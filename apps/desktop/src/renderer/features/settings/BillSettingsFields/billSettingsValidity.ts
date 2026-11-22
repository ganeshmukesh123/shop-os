import { isValidTimeZone } from "@shopos/core";
import { DOC_TITLE_MAX_LENGTH } from "./BillSettingsFields.constants";
import type { BillSettings } from "./BillSettingsFields.types";

/** True when the settings can be saved: a title of 1 to 30 characters and a time zone the platform knows. */
export function isBillSettingsValid(settings: BillSettings): boolean {
  const title = settings.docTitle.trim();
  const isTitleAllowed = title.length > 0 && title.length <= DOC_TITLE_MAX_LENGTH;
  return isTitleAllowed && isValidTimeZone(settings.timeZone);
}
