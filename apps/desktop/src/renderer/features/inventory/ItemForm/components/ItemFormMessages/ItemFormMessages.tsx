import { formatQuantity } from "@shopos/core";
import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { uiText } from "../../../../../shared/text/strings";
import type { IItemFormMessagesProps } from "./types";

/** The Error messages for the form, and the Duplicate name warning with the items already there. */
export function ItemFormMessages({ errors, duplicateItems }: IItemFormMessagesProps) {
  return (
    <>
      {errors.map((errorMessage) => (
        <StatusMessage key={errorMessage} role="danger" label={uiText.status.error}>
          {errorMessage}
        </StatusMessage>
      ))}
      {duplicateItems.length > 0 && (
        <StatusMessage role="warning" label={uiText.status.duplicate}>
          {uiText.form.duplicateTitle}. {uiText.form.duplicateHelp}{" "}
          {duplicateItems
            .map(
              (duplicateItem) =>
                `${duplicateItem.name} (${formatQuantity(duplicateItem.stockMilli)} ${duplicateItem.unit} in stock)`,
            )
            .join("; ")}
        </StatusMessage>
      )}
    </>
  );
}
