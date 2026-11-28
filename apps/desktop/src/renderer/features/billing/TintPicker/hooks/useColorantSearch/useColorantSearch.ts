import { useState } from "react";
import type { Item } from "@shopos/core";
import { call } from "../../../../../shared/api/api";
import { COLORANT_SEARCH_LIMIT } from "../../constants";

/** Items matching what is typed, to add as colorants; main refuses any that is not (NOT_A_COLORANT). */
export function useColorantSearch() {
  const [query, setQueryText] = useState("");
  const [matches, setMatches] = useState<Item[]>([]);
  const setQuery = async (nextQuery: string) => {
    setQueryText(nextQuery);
    const found = await call("items.search", { query: nextQuery, limit: COLORANT_SEARCH_LIMIT });
    setMatches(found.results.flatMap((row) => (row.item ? [row.item] : [])));
  };
  return { query, matches, setQuery };
}
