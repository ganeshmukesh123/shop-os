import { useState } from "react";

/**
 * Gives focus back to the control that was focused when the dialog opened (BillView's Cancel bill
 * button), however the dialog closes. Radix restores focus only to an `AlertDialog.Trigger`, and
 * this dialog has none, so without this focus drops to the page body and keyboard users lose
 * their place.
 */
export function useReturnFocus(): (closeFocusEvent: Event) => void {
  const [opener] = useState(() => document.activeElement);
  return (closeFocusEvent) => {
    const canReturnFocus = opener instanceof HTMLElement && opener.isConnected;
    if (canReturnFocus) {
      closeFocusEvent.preventDefault();
      opener.focus();
    }
  };
}
