import { forwardRef, type KeyboardEvent } from "react";
import { Box, Text, TextField } from "@radix-ui/themes";
import { formatQuantity, formatRupees } from "@shopos/core";
import { fillText } from "../../../../../shared/text/fillText";
import { uiText } from "../../../../../shared/text/strings";
import { MIN_QUERY_LENGTH } from "../../constants";
import { looksLikeScannedCode } from "./scannedCode";
import type { IBillSearchBoxProps } from "./types";

/** The item search: type, move with the arrow keys, press Enter or click to add. */
export const BillSearchBox = forwardRef<HTMLInputElement, IBillSearchBoxProps>(
  function BillSearchBox(
    { query, matches, highlightedIndex, onQueryChange, onHighlightChange, onChoose, onEnterCode },
    searchRef,
  ) {
    const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
      if (keyboardEvent.key === "ArrowDown") {
        keyboardEvent.preventDefault();
        onHighlightChange(Math.min(highlightedIndex + 1, matches.length - 1));
      } else if (keyboardEvent.key === "ArrowUp") {
        keyboardEvent.preventDefault();
        onHighlightChange(Math.max(highlightedIndex - 1, 0));
      } else if (keyboardEvent.key === "Enter" && onEnterCode && looksLikeScannedCode(query)) {
        keyboardEvent.preventDefault();
        onEnterCode(query);
      } else if (keyboardEvent.key === "Enter" && matches[highlightedIndex]) {
        keyboardEvent.preventDefault();
        onChoose(matches[highlightedIndex]!);
      } else if (keyboardEvent.key === "Escape") {
        onQueryChange("");
      }
    };

    return (
      <Box position="relative">
        <TextField.Root
          ref={searchRef}
          size="3"
          autoFocus
          placeholder={uiText.bill.search}
          aria-label={uiText.bill.search}
          value={query}
          onChange={(changeEvent) => onQueryChange(changeEvent.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query.trim().length >= MIN_QUERY_LENGTH && (
          <ul
            role="listbox"
            aria-label={uiText.bill.matchingItems}
            className="shopos-search-results"
          >
            {matches.length === 0 && (
              <li className="shopos-search-empty">
                <Text color="gray">{uiText.bill.noMatch}</Text>
              </li>
            )}
            {matches.map((matchingRow, listIndex) => (
              <li
                key={matchingRow.id}
                role="option"
                aria-selected={listIndex === highlightedIndex}
                onMouseDown={(mouseEvent) => {
                  mouseEvent.preventDefault();
                  onChoose(matchingRow);
                }}
                onMouseEnter={() => onHighlightChange(listIndex)}
                className="shopos-search-result"
              >
                <span>
                  {matchingRow.displayName}{" "}
                  <Text color="gray" size="2">
                    ({matchingRow.item ? matchingRow.item.unit : uiText.bill.grid.familyRow})
                  </Text>
                </span>
                <span>
                  {fillText(uiText.bill.searchResultStock, {
                    price: formatRupees(matchingRow.pricePaise),
                    quantity: formatQuantity(matchingRow.stockMilli),
                  })}
                  {matchingRow.stockMilli < 0 && ` ${uiText.bill.searchResultNegative}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Box>
    );
  },
);
