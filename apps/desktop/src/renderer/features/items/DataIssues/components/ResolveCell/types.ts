import type { IExceptionEvent } from "@shopos/core";

export interface IResolveCellProps {
  event: IExceptionEvent;
  isResolving: boolean;
  note: string;
  onStart: () => void;
  onNote: (note: string) => void;
  onConfirm: () => void;
}
