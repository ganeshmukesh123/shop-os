import { forwardRef, type KeyboardEvent } from "react";
import { Box, Text, TextField } from "@radix-ui/themes";
import { formatQuantity, formatRupees } from "@shopos/core";
import { uiText } from "../../../../../shared/text/strings";
import { MIN_QUERY_LENGTH } from "../../constants";
import type { IBillSearchBoxProps } from "./types";

/** The item search: type, move with the arrow keys, press Enter or click to add. */
export const BillSearchBox = forwardRef<HTMLInputElement, IBillSearchBoxProps>(
  function BillSearchBox(
    { query, matches, highlightedIndex, onQueryChange, onHighlightChange, onChoose },
    searchRef,
  ) {
    const handleKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
      if (keyboardEvent.key === "ArrowDown") {
        keyboardEvent.preventDefault();
        onHighlightChange(Math.min(highlightedIndex + 1, matches.length - 1));
      } else if (keyboardEvent.key === "ArrowUp") {
        keyboardEvent.preventDefault();
        onHighlightChange(Math.max(highlightedIndex - 1, 0));
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
          <ul role="listbox" aria-label="Matching items" className="shopos-search-results">
            {matches.length === 0 && (
              <li className="shopos-search-empty">
                <Text color="gray">{uiText.bill.noMatch}</Text>
              </li>
            )}
            {matches.map((matchingItem, listIndex) => (
              <li
                key={matchingItem.id}
                role="option"
                aria-selected={listIndex === highlightedIndex}
                onMouseDown={(mouseEvent) => {
                  mouseEvent.preventDefault();
                  onChoose(matchingItem);
                }}
                onMouseEnter={() => onHighlightChange(listIndex)}
                className="shopos-search-result"
              >
                <span>
                  {matchingItem.name}{" "}
                  <Text color="gray" size="2">
                    ({matchingItem.unit})
                  </Text>
                </span>
                <span>
                  {formatRupees(matchingItem.pricePaise)} · stock{" "}
                  {formatQuantity(matchingItem.stockMilli)}
                  {matchingItem.needsCorrection ? " (negative)" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Box>
    );
  },
);
