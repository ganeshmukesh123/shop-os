import { useState } from "react";
import { Button } from "@radix-ui/themes";
import { uiText } from "../../../shared/text/strings";
import { FamilyForm } from "../FamilyForm";
import { useCatalogueLists } from "../hooks/useCatalogueLists";
import type { INewFamilyButtonProps } from "./types";

/** "New family" on the Items screen: opens the family form with the shop's lists (spec 002 US1). */
export function NewFamilyButton({ onSaved, onOpenExisting }: INewFamilyButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const lists = useCatalogueLists(isOpen);
  return (
    <>
      <Button size="3" variant="soft" onClick={() => setIsOpen(true)}>
        {uiText.family.open}
      </Button>
      {isOpen && (
        <FamilyForm
          categories={lists.categories}
          brands={lists.brands}
          units={lists.units}
          onClose={() => setIsOpen(false)}
          onOpenExisting={(duplicate) => {
            setIsOpen(false);
            onOpenExisting?.(duplicate);
          }}
          onSaved={(family) => {
            setIsOpen(false);
            onSaved(family);
          }}
        />
      )}
    </>
  );
}
