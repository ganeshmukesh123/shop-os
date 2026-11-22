import type { ClockWarning } from "@shopos/core";

export interface IClockWarningsProps {
  /** What the clock check found; empty means all is well and nothing is shown. */
  warnings: ClockWarning[];
}
