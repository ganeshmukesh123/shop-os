import { useState } from "react";
import { Flex, Text, TextField } from "@radix-ui/themes";
import type { ITintShade } from "@shopos/core";
import { call } from "../../../shared/api/api";
import { uiText } from "../../../shared/text/strings";
import { ShadeTable } from "./components/ShadeTable";

/** The library and custom shades, found by name or code (spec 002 T066). */
export function ShadeLibrary() {
  const text = uiText.tinting.shades;
  const [query, setQuery] = useState("");
  const [shades, setShades] = useState<ITintShade[]>([]);
  const search = async (nextQuery: string) => {
    setQuery(nextQuery);
    setShades((await call("tint.shades.search", { query: nextQuery })).shades);
  };
  return (
    <Flex direction="column" gap="3" pt="3">
      <Text as="label" size="2" weight="medium">
        {text.find}
        <TextField.Root
          mt="1"
          size="3"
          value={query}
          onChange={(event) => void search(event.target.value)}
        />
      </Text>
      {query !== "" && shades.length === 0 && <Text color="gray">{text.none}</Text>}
      {shades.length > 0 && <ShadeTable shades={shades} />}
    </Flex>
  );
}
