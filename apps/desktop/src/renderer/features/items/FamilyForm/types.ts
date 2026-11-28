import type { IBrand, ICategory, IFamily, IUnit } from "@shopos/core";

/** The lists come from the caller (catalogue.* commands); the form itself fetches nothing else. */
export interface IFamilyFormProps {
  categories: readonly ICategory[];
  brands: readonly IBrand[];
  units: readonly IUnit[];
  onClose: () => void;
  onSaved: (family: IFamily) => void;
}
