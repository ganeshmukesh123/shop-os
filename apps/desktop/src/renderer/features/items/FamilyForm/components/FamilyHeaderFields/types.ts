import type { FamilyKind, IBrand, ICategory, IUnit } from "@shopos/core";

export interface IFamilyHeaderFieldsProps {
  name: string;
  kind: FamilyKind;
  categoryId: string;
  brandId: string;
  unit: string;
  categories: readonly ICategory[];
  brands: readonly IBrand[];
  units: readonly IUnit[];
  setName: (name: string) => void;
  setKind: (kind: FamilyKind) => void;
  setCategoryId: (categoryId: string) => void;
  setBrandId: (brandId: string) => void;
  setUnit: (unit: string) => void;
}

export interface ILabelledSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}
