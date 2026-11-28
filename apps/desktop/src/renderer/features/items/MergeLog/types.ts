export interface IMergeLogButtonProps {
  /** A merge was reversed: the item list should reload */
  onReversed: () => void;
}

export interface IMergeLogDialogProps extends IMergeLogButtonProps {
  onClose: () => void;
}
