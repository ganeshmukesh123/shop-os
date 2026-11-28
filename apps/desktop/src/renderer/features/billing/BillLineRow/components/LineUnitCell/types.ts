import type { DraftLine, DraftLineResult } from "@shopos/core";

export interface IUnitSelectProps {
  line: DraftLine;
  chosen: string;
  onChange: (patch: Partial<DraftLine>) => void;
}

export interface ILineUnitCellProps {
  line: DraftLine;
  result: DraftLineResult;
  onChange: (patch: Partial<DraftLine>) => void;
}
