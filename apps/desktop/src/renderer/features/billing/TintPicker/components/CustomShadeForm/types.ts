import type { ITintShade } from "@shopos/core";

export interface ICustomShadeFormProps {
  baseVariantId: string;
  customerName: string;
  onSaved: (shade: ITintShade) => void;
  onCancel: () => void;
}
