/** Colour roles of the design guidelines (2.1): what a status means, never a colour name. */
export type StatusRole = "primary" | "danger" | "warning" | "success" | "neutral";

/** The Radix colours a role can map to; undefined means the theme's accent colour. */
export type StatusColor = "red" | "orange" | "green" | "gray" | undefined;

/** How a screen reader announces a message: problems at once, results politely. */
export type StatusLiveRole = "alert" | "status";
