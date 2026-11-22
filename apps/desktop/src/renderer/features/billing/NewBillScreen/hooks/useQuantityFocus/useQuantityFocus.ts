import { useCallback, useEffect, useRef } from "react";
import type { IQuantityFocus } from "./types";

/**
 * After an item is added, its quantity is focused and selected, so the cashier can type "3" at once.
 * The field may only exist after the next render, so the line key is remembered until it does.
 */
export function useQuantityFocus(): IQuantityFocus {
  const quantityFields = useRef(new Map<string, HTMLInputElement>());
  const lineToFocus = useRef<string | null>(null);

  const rememberLineToFocus = useCallback((lineKey: string) => {
    lineToFocus.current = lineKey;
  }, []);

  const onQtyFieldRef = useCallback((lineKey: string, quantityField: HTMLInputElement | null) => {
    const isMounted = quantityField !== null;
    if (isMounted) {
      quantityFields.current.set(lineKey, quantityField);
      return;
    }
    quantityFields.current.delete(lineKey);
  }, []);

  useEffect(() => {
    const quantityField = lineToFocus.current && quantityFields.current.get(lineToFocus.current);
    if (quantityField) {
      quantityField.focus();
      quantityField.select();
      lineToFocus.current = null;
    }
  });

  return { rememberLineToFocus, onQtyFieldRef };
}
