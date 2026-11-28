import type { FamilyKind, IFamily } from "@shopos/core";

/** One combination in the preview table, with what the owner typed for it. */
export interface IPreviewRow {
  axes: Record<string, string>;
  axisSignature: string;
  displayName: string;
  isChosen: boolean;
  priceText: string;
  openingText: string;
}

export interface IFamilyFormState {
  name: string;
  kind: FamilyKind;
  categoryId: string;
  brandId: string;
  unit: string;
  axisKeys: string[];
  rows: IPreviewRow[];
}

export interface IUseFamilyFormOptions {
  onSaved: (family: IFamily) => void;
}

export interface IFamilyForm extends IFamilyFormState {
  axisValuesText: Record<string, string>;
  axisLimitReason: string | null;
  errors: string[];
  isBusy: boolean;
  setName: (name: string) => void;
  setKind: (kind: FamilyKind) => void;
  setCategoryId: (categoryId: string) => void;
  setBrandId: (brandId: string) => void;
  setUnit: (unit: string) => void;
  toggleAxis: (key: string) => void;
  setAxisValuesText: (key: string, valuesText: string) => void;
  preview: () => Promise<void>;
  toggleRow: (axisSignature: string) => void;
  setRowPrice: (axisSignature: string, priceText: string) => void;
  setRowOpening: (axisSignature: string, openingText: string) => void;
  save: () => Promise<void>;
}
