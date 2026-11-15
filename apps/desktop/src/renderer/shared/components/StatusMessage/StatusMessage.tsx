import { Button, Callout, Text } from "@radix-ui/themes";
import { STATUS_COLOR_BY_ROLE, STATUS_LIVE_ROLE_BY_ROLE } from "../status.constants";
import type { IStatusMessageProps } from "./StatusMessage.types";

/**
 * The one message pattern (design guidelines 5.1): label first, a plain sentence, one action last.
 * The label carries the meaning, so the colour is never the only signal.
 */
export function StatusMessage({ role, label, children, action }: IStatusMessageProps) {
  return (
    <Callout.Root color={STATUS_COLOR_BY_ROLE[role]} role={STATUS_LIVE_ROLE_BY_ROLE[role]}>
      <Callout.Text>
        <Text weight="bold">{label}</Text> {children}
        {action && (
          <Button
            size="1"
            variant="soft"
            color={STATUS_COLOR_BY_ROLE[role]}
            ml="3"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </Callout.Text>
    </Callout.Root>
  );
}
