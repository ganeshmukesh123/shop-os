import type { ReactNode } from "react";
import type { StatusRole } from "../status.types";

export interface IStatusAction {
  /** Names what happens: "Print", "Ask owner", not "OK". */
  label: string;
  onClick: () => void;
}

export interface IStatusMessageProps {
  role: StatusRole;
  /** The word that opens the message: Blocked, Pending, Saved, Negative stock. */
  label: string;
  /** One plain sentence saying what happened and what to do next. */
  children: ReactNode;
  action?: IStatusAction;
}
