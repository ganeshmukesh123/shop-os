export interface IChoiceListProps {
  label: string;
  choices: readonly { id: string; label: string }[];
  value: string;
  /** Said when there is nothing to choose; nothing shown when absent */
  emptyText?: string;
  onChoose: (id: string) => void;
}
