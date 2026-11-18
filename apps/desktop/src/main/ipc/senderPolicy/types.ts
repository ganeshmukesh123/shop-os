/** What the sender check needs to know about the frame that sent a command. */
export interface ISenderSummary {
  /** True only for the window's top frame, never for a child frame. */
  isMainFrame: boolean;
  /** The full address the frame is showing (not its serialized origin, which is "null" for some schemes). */
  url: string;
}

/** The part of an Electron IPC event the check reads; a plain shape so tests need no Electron. */
export interface ISenderEvent {
  senderFrame?: { url: string } | null;
  sender?: { mainFrame: unknown };
}
