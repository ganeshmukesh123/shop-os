import type { ITintShade } from "@shopos/core";

export interface IShadeFinderProps {
  query: string;
  shades: readonly ITintShade[];
  shadeId: string;
  onQuery: (query: string) => void;
  onChoose: (shadeId: string) => void;
}
