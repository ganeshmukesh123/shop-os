import type { ShopProfile } from "@shopos/core";
import type { NumberTemplateCheck } from "../../numberTemplateCheck";

export interface IShopProfileFieldsProps {
  profile: ShopProfile;
  /** What the shop's bill-number template gives: an example, or why it is refused. */
  templateCheck: NumberTemplateCheck;
  /** Called with only the fields that changed. */
  onChange: (patch: Partial<ShopProfile>) => void;
}
