export interface IDebugSwitchContext {
  isPackaged: boolean;
  /** True only in the e2e build flavour (`pnpm package:e2e`), fixed when the bundle is built. */
  allowsDebugSwitches: boolean;
}

export type HasCommandLineSwitch = (switchName: string) => boolean;
