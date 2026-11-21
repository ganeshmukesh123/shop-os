/** Which words in `uiText.clock` belong to each warning: the label that opens it and its sentence. */
export const CLOCK_WARNING_TEXT = {
  TIME_ZONE_DIFFERS: { label: "timeZoneLabel", sentence: "timeZoneDiffers" },
  CLOCK_BEFORE_LAST_BILL: { label: "behindLabel", sentence: "behindLastBill" },
} as const;
