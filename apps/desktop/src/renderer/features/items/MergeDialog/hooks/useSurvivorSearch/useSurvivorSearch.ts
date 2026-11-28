import { useState } from "react";
import type { Item } from "@shopos/core";
import { call } from "../../../../../shared/api/api";
import { SURVIVOR_SEARCH_LIMIT } from "../../constants";

/** Other items in the same unit that the duplicate could be merged into (spec 002 T051). */
export function useSurvivorSearch(item: Item) {
  const [query, setQueryText] = useState("");
  const [matches, setMatches] = useState<Item[]>([]);

  const setQuery = async (nextQuery: string) => {
    setQueryText(nextQuery);
    const found = await call("items.list", {
      query: nextQuery,
      limit: SURVIVOR_SEARCH_LIMIT,
      offset: 0,
    });
    setMatches(found.items.filter((match) => match.id !== item.id && match.unit === item.unit));
  };

  return { query, setQuery, matches };
}
