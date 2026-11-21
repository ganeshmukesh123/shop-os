import { Flex } from "@radix-ui/themes";
import { StatusMessage } from "../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../strings";
import { CLOCK_WARNING_TEXT } from "./ClockWarnings.constants";
import type { IClockWarningsProps } from "./ClockWarnings.types";

/**
 * Tells the shop the clock or the time zone looks wrong. Always a warning with a word, never a
 * block: billing carries on (constitution IV; FR-019a).
 */
export function ClockWarnings({ warnings }: IClockWarningsProps) {
  if (warnings.length === 0) return null;
  return (
    <Flex direction="column" gap="2" mb="3">
      {warnings.map((warning) => (
        <StatusMessage
          key={warning}
          role="warning"
          label={uiText.clock[CLOCK_WARNING_TEXT[warning].label]}
        >
          {uiText.clock[CLOCK_WARNING_TEXT[warning].sentence]}
        </StatusMessage>
      ))}
    </Flex>
  );
}
