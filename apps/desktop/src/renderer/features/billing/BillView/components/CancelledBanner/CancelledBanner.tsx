import { StatusMessage } from "../../../../../shared/components/StatusMessage/StatusMessage";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import type { ICancelledBannerProps } from "./types";

/**
 * The CANCELLED banner of a cancelled bill: the word, the reason and when (FR-017). The bill, its
 * number and its lines stay on screen below it.
 */
export function CancelledBanner({ cancelReason, cancelledAt }: ICancelledBannerProps) {
  const when = cancelledAt
    ? ` ${fillText(uiText.bill.cancelledOn, { when: new Date(cancelledAt).toLocaleString() })}`
    : "";
  return (
    <StatusMessage role="danger" label={uiText.status.cancelled}>
      {fillText(uiText.bill.cancelledReason, { reason: cancelReason ?? "" })}
      {when}
    </StatusMessage>
  );
}
