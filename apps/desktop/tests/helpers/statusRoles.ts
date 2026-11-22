import type { StatusRole } from "../../src/renderer/shared/components/status.types";

/** Each colour role and the Radix colour a status shows for it (design guidelines 2.1). */
export const ROLES_AND_COLOURS: [StatusRole, string][] = [
  ["danger", "red"],
  ["warning", "orange"],
  ["success", "green"],
  ["neutral", "gray"],
  ["primary", ""], // the theme's accent colour: Radix writes an empty colour attribute
];
