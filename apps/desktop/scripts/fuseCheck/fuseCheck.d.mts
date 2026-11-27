export interface IExpectedFuse {
  readonly name: string;
  /** Position in the fuse wire (FuseV1Options). */
  readonly index: number;
  readonly isEnabled: boolean;
}

export declare const FUSE_STATE: Readonly<{
  disabled: number;
  enabled: number;
  removed: number;
  inherited: number;
}>;

export declare const EXPECTED_FUSES: readonly IExpectedFuse[];

export declare function findFuseDifferences(
  fuseWire: Readonly<Record<number, number>>,
  expectedFuses: readonly IExpectedFuse[],
): string[];
