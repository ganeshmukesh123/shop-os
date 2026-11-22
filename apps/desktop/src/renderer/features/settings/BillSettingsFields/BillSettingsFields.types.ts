import type { ShopProfile } from "@shopos/core";

/** The shop settings that shape every bill: its title, rounding, time zone and paper. */
export type BillSettings = Pick<
  ShopProfile,
  "docTitle" | "roundBillTotal" | "timeZone" | "receiptWidth"
>;

export interface IBillSettingsFieldsProps {
  settings: BillSettings;
  /** Called with only the fields that changed. */
  onChange: (patch: Partial<ShopProfile>) => void;
}
