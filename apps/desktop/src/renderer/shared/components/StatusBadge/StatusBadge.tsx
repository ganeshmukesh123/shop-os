import { Badge } from "@radix-ui/themes";
import { STATUS_COLOR_BY_ROLE } from "../status.constants";
import type { StatusRole } from "../status.types";

interface IStatusBadgeProps {
  role: StatusRole;
  /** The word that carries the meaning. A status is never a coloured dot alone. */
  label: string;
  size?: "1" | "2" | "3";
}

/** A short status word in its role's colour (design guidelines 4.2). */
export function StatusBadge({ role, label, size }: IStatusBadgeProps) {
  return (
    <Badge color={STATUS_COLOR_BY_ROLE[role]} size={size}>
      {label}
    </Badge>
  );
}
