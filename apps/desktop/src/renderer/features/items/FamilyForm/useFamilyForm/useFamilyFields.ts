import { useState } from "react";
import type { FamilyKind } from "@shopos/core";

/** The family's own fields: name, kind, category, brand and the unit its variants are sold in. */
export function useFamilyFields() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FamilyKind>("general");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [unit, setUnit] = useState("");
  return {
    name,
    kind,
    categoryId,
    brandId,
    unit,
    setName,
    setKind,
    setCategoryId,
    setBrandId,
    setUnit,
  };
}
