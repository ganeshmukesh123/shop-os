import { Button, Flex } from "@radix-ui/themes";
import { StatusMessage } from "../../../../../shared/components/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import type { IFormulaProblemProps } from "./types";

/** "No formula for this pack" with Custom shade, or what else went wrong (spec 002 T064). */
export function FormulaProblem({ isNoFormula, message, onCustomShade }: IFormulaProblemProps) {
  const text = uiText.bill.tintPicker;
  return (
    <Flex direction="column" gap="3">
      <StatusMessage role="warning" label={isNoFormula ? text.noFormulaLabel : text.errorLabel}>
        {isNoFormula ? text.noFormula : message}
      </StatusMessage>
      {isNoFormula && (
        <Flex>
          <Button size="3" variant="soft" onClick={onCustomShade}>
            {text.customShade}
          </Button>
        </Flex>
      )}
    </Flex>
  );
}
