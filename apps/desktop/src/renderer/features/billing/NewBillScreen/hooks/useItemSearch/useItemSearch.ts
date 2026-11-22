import { useCallback, useEffect, useState } from "react";
import type { Item } from "@shopos/core";
import { call } from "../../../../../shared/api/api";
import { MAX_MATCHES, MIN_QUERY_LENGTH } from "../../constants";
import type { IItemSearch } from "./types";

/** Item search for the bill: looks up matches as the cashier types, keeping only the latest answer. */
export function useItemSearch(): IItemSearch {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Item[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setMatches([]);
      return;
    }
    let isLatestQuery = true;
    call("items.list", { query: query.trim(), limit: MAX_MATCHES, offset: 0 })
      .then((listResult) => {
        if (isLatestQuery) {
          setMatches(listResult.items);
          setHighlightedIndex(0);
        }
      })
      .catch(() => {});
    return () => {
      isLatestQuery = false;
    };
  }, [query]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setMatches([]);
  }, []);

  return { query, matches, highlightedIndex, setQuery, setHighlightedIndex, clearSearch };
}
