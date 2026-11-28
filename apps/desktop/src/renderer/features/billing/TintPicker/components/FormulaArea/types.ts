import type { useTintPicker } from "../../hooks/useTintPicker";

export interface IFormulaAreaProps {
  desk: ReturnType<typeof useTintPicker>;
  customerName: string;
  onAdd: () => void;
}
