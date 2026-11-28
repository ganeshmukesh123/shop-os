import type { IExceptionEvent } from "@shopos/core";
import type { useResolveIssue } from "../../hooks/useResolveIssue";

export interface IIssueTableProps {
  events: readonly IExceptionEvent[];
  resolving: ReturnType<typeof useResolveIssue>;
  emptyText: string;
}
