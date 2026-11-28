export interface IReverseCellProps {
  isReversed: boolean;
  daysLeft: number;
  isReversing: boolean;
  reason: string;
  onStartReverse: () => void;
  onReason: (reason: string) => void;
  onConfirm: () => void;
}
