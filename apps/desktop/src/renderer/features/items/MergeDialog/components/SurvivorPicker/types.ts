import type { Item } from "@shopos/core";

export interface ISurvivorPickerProps {
  query: string;
  matches: readonly Item[];
  survivorId: string;
  onQuery: (query: string) => void;
  onChoose: (survivorId: string) => void;
}
