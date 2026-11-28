import { useState } from "react";
import { Button } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { DataIssuesDialog } from "./DataIssuesDialog";

/** "Data issues" on the Items screen (spec 002 T052). */
export function DataIssuesButton() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button size="3" variant="soft" color="gray" onClick={() => setIsOpen(true)}>
        {uiText.dataIssues.open}
      </Button>
      {isOpen && <DataIssuesDialog onClose={() => setIsOpen(false)} />}
    </>
  );
}
