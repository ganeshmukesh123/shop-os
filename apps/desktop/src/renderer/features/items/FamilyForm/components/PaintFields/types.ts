import type { FamilyKind, IUnit } from "@shopos/core";
import type { IPaintFields } from "../../useFamilyForm/types";

export interface IPaintFieldsProps {
  kind: FamilyKind;
  paint: IPaintFields;
  units: readonly IUnit[];
  onChange: (change: Partial<IPaintFields>) => void;
}

export interface ITextFieldRowProps {
  label: string;
  value: string;
  inputMode?: "decimal" | "numeric" | "text";
  maxLength?: number;
  onChange: (value: string) => void;
}

export interface ISelectRowProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface ICheckboxRowProps {
  label: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}
