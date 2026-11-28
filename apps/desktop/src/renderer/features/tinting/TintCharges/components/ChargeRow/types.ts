import type { IChargeRowText } from "../../chargeRows";

export interface IChargeRowProps {
  row: IChargeRowText;
  onChange: (patch: Partial<IChargeRowText>) => void;
  onRemove: () => void;
}
