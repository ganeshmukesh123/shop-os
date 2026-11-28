import type { PrintTarget } from "@shopos/core";

export interface IPrintTargetSelectProps {
  target: PrintTarget;
  onTargetChange: (target: PrintTarget) => void;
}
