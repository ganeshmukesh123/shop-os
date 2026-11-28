import { useState } from "react";
import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { NEW_NAME_DEFAULTS } from "../../constants";
import { CodeRow } from "../CodeRow";
import type { ISearchNameListProps } from "./types";

/** The item's search names, each with its language and kind, plus a box to add one (T049). */
export function SearchNameList({ names, onChange }: ISearchNameListProps) {
  const text = uiText.names;
  const [draft, setDraft] = useState("");
  const add = () => {
    if (draft.trim() === "") return;
    onChange([...names, { name: draft.trim(), ...NEW_NAME_DEFAULTS }]);
    setDraft("");
  };
  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">{text.searchNames}</Text>
      {names.length === 0 && <Text color="gray">{text.none}</Text>}
      {names.map((searchName) => (
        <CodeRow
          key={searchName.name.toLowerCase()}
          value={searchName.name}
          detail={`${text.languages[searchName.language]}, ${text.kinds[searchName.kind]}`}
          onRemove={() => onChange(names.filter((other) => other !== searchName))}
        />
      ))}
      <Flex gap="2">
        <TextField.Root
          aria-label={text.newName}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button variant="soft" onClick={add}>
          {text.addName}
        </Button>
      </Flex>
    </Flex>
  );
}
