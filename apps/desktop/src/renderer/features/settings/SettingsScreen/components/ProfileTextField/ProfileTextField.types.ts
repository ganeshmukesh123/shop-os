export interface IProfileTextFieldProps {
  label: string;
  help?: string;
  value: string;
  maxLength: number;
  onTextChange: (text: string) => void;
}
