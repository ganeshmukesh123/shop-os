import type { IBarcode, ISearchName } from "@shopos/core";

/** What a new row gets until the owner picks otherwise: most shop names are Hinglish aliases. */
export const NEW_NAME_DEFAULTS: Pick<ISearchName, "language" | "kind"> = {
  language: "hinglish",
  kind: "alias",
};
export const NEW_CODE_SOURCE: IBarcode["source"] = "manufacturer";
