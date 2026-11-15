import type { StatusColor, StatusLiveRole, StatusRole } from "./status.types";

/** Danger red, warning orange (open question D3: amber), success green, neutral gray, primary accent. */
export const STATUS_COLOR_BY_ROLE: Record<StatusRole, StatusColor> = {
  primary: undefined,
  danger: "red",
  warning: "orange",
  success: "green",
  neutral: "gray",
};

export const STATUS_LIVE_ROLE_BY_ROLE: Record<StatusRole, StatusLiveRole> = {
  primary: "status",
  danger: "alert",
  warning: "alert",
  success: "status",
  neutral: "status",
};
