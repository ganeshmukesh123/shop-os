import type { IFamily } from "@shopos/core";

export interface INewFamilyButtonProps {
  onSaved: (family: IFamily) => void;
}
