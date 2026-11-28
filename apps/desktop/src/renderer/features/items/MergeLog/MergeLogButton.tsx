import { useState } from "react";
import { Button } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { MergeLogDialog } from "./MergeLogDialog";
import type { IMergeLogButtonProps } from "./types";

/** "Merge log" on the Items screen (spec 002 T051). */
export function MergeLogButton({ onReversed }: IMergeLogButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button size="3" variant="soft" color="gray" onClick={() => setIsOpen(true)}>
        {uiText.mergeLog.open}
      </Button>
      {isOpen && <MergeLogDialog onClose={() => setIsOpen(false)} onReversed={onReversed} />}
    </>
  );
}
