import { useState } from "react";
import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { uiText } from "../../../../../shared/text/strings";
import { NEW_CODE_SOURCE } from "../../constants";
import { CodeRow } from "../CodeRow";
import type { IBarcodeListProps } from "./types";

/** The item's barcodes, each with where it came from, plus a box to add one (T049). */
export function BarcodeList({ codes, onChange }: IBarcodeListProps) {
  const text = uiText.names;
  const [draft, setDraft] = useState("");
  const add = () => {
    if (draft.trim() === "") return;
    onChange([...codes, { code: draft.trim(), source: NEW_CODE_SOURCE }]);
    setDraft("");
  };
  return (
    <Flex direction="column" gap="2">
      <Text weight="bold">{text.barcodes}</Text>
      {codes.length === 0 && <Text color="gray">{text.none}</Text>}
      {codes.map((barcode) => (
        <CodeRow
          key={barcode.code}
          value={barcode.code}
          detail={text.sources[barcode.source]}
          onRemove={() => onChange(codes.filter((other) => other !== barcode))}
        />
      ))}
      <Flex gap="2">
        <TextField.Root
          aria-label={text.newCode}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button variant="soft" onClick={add}>
          {text.addCode}
        </Button>
      </Flex>
    </Flex>
  );
}
