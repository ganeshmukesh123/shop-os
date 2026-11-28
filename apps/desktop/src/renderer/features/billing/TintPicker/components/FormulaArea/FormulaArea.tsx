import { useState } from "react";
import { CustomShadeForm } from "../CustomShadeForm";
import { FormulaProblem } from "../FormulaProblem";
import { MixPanel } from "../MixPanel";
import type { IFormulaAreaProps } from "./types";

/** Under the choices: the mix and Add, or why there is none, or the custom shade form (T064). */
export function FormulaArea({ desk, customerName, onAdd }: IFormulaAreaProps) {
  const [isCustom, setIsCustom] = useState(false);
  if (isCustom) {
    return (
      <CustomShadeForm
        baseVariantId={desk.choice.packId}
        customerName={customerName}
        onCancel={() => setIsCustom(false)}
        onSaved={(shade) => {
          setIsCustom(false);
          desk.remember(shade);
          void desk.choose({ shadeId: shade.id });
        }}
      />
    );
  }
  if (desk.resolved) return <MixPanel resolved={desk.resolved} onAdd={onAdd} />;
  return desk.problem ? (
    <FormulaProblem {...desk.problem} onCustomShade={() => setIsCustom(true)} />
  ) : null;
}
