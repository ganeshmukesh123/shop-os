export interface IRoundOffLineProps {
  /** Signed difference to the nearest rupee: +40 for 849.60, -49 for 849.49, 0 when off. */
  roundOffPaise: number;
}
