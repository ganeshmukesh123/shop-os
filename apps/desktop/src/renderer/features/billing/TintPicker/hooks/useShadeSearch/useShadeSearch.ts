import { useState } from "react";
import type { ITintShade } from "@shopos/core";
import { call } from "../../../../../shared/api/api";

/** The shades matching what is typed (spec 002 T064, tint.shades.search). */
export function useShadeSearch() {
  const [query, setQueryText] = useState("");
  const [shades, setShades] = useState<ITintShade[]>([]);
  const setQuery = async (nextQuery: string) => {
    setQueryText(nextQuery);
    setShades((await call("tint.shades.search", { query: nextQuery })).shades);
  };
  // A shade just saved here joins the list, so it can be chosen at once
  const remember = (shade: ITintShade) => setShades((current) => [shade, ...current]);
  return { query, shades, setQuery, remember };
}
