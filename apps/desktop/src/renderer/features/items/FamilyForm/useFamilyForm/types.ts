import type { FamilyKind, IFamily, PetroleumClass } from "@shopos/core";

/** One combination in the preview table, with what the owner typed for it. */
export interface IPreviewRow {
  axes: Record<string, string>;
  axisSignature: string;
  displayName: string;
  isChosen: boolean;
  priceText: string;
  openingText: string;
}

/** Paint, warranty and serial fields, as typed; every kept variant gets them (T079). */
export interface IPaintFields {
  petroleumClass: PetroleumClass | "";
  declaredQtyText: string;
  declaredUom: string;
  tradeLabel: string;
  sealedPackOnly: boolean;
  warrantyText: string;
  isSerialTracked: boolean;
}

export interface IFamilyFormState {
  name: string;
  kind: FamilyKind;
  categoryId: string;
  brandId: string;
  unit: string;
  axisKeys: string[];
  rows: IPreviewRow[];
  paint: IPaintFields;
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
  setPaint: (change: Partial<IPaintFields>) => void;
}
