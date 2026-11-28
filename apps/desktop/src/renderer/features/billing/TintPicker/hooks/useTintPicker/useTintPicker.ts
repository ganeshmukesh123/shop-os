import { useEffect, useState } from "react";
import type { ITintResolved, IVariant } from "@shopos/core";
import { ApiError, call, messageOf } from "../../../../../shared/api/api";
import { useShadeSearch } from "../useShadeSearch";

/**
 * The tinting desk's state (spec 002 T064): the product's cans, the shades matching what is
 * typed, and, once a shade and a can are chosen, tint.resolve's answer or "no formula".
 */
export function useTintPicker(familyId: string) {
  const search = useShadeSearch();
  const [packs, setPacks] = useState<IVariant[]>([]);
  const [choice, setChoice] = useState({ shadeId: "", packId: "" });
  const [resolved, setResolved] = useState<ITintResolved | null>(null);
  const [problem, setProblem] = useState<{ isNoFormula: boolean; message: string } | null>(null);

  // Read the product's cans from main once, when the desk opens
  useEffect(() => {
    void call("families.get", { id: familyId }).then((detail) =>
      setPacks(detail.variants.filter((variant) => variant.isActive && !variant.mergedIntoId)),
    );
  }, [familyId]);

  const choose = async (change: Partial<typeof choice>) => {
    const next = { ...choice, ...change };
    setChoice(next);
    setResolved(null);
    setProblem(null);
    if (!next.shadeId || !next.packId) return;
    const input = { productFamilyId: familyId, shadeId: next.shadeId, packVariantId: next.packId };
    try {
      setResolved(await call("tint.resolve", input));
    } catch (caughtError) {
      const isNoFormula = caughtError instanceof ApiError && caughtError.code === "NO_FORMULA";
      setProblem({ isNoFormula, message: messageOf(caughtError) });
    }
  };

  const shade = search.shades.find((candidate) => candidate.id === choice.shadeId) ?? null;
  return { ...search, packs, choice, choose, shade, resolved, problem };
}
