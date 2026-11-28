export interface IAxisPickerProps {
  axisKeys: readonly string[];
  axisValuesText: Readonly<Record<string, string>>;
  axisLimitReason: string | null;
  onToggle: (key: string) => void;
  onValuesChange: (key: string, valuesText: string) => void;
}
