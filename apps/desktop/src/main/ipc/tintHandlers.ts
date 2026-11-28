import {
  tintChargesSaveInput,
  tintCustomShadeSaveInput,
  tintRepeatListInput,
  tintResolveInput,
  tintSaveVersionInput,
  tintShadesSearchInput,
  type ITintCommandMap,
} from "@shopos/core";
import { cmd, none } from "./command";
import type { Handlers, Services } from "./handlers";

/** The tint.* commands (spec 002 T063). bills.save takes tinted lines through its own input. */
export function createTintHandlers({ tints }: Services): Pick<Handlers, keyof ITintCommandMap> {
  return {
    "tint.shades.search": cmd<"tint.shades.search">(tintShadesSearchInput, (input) =>
      tints.searchShades(input),
    ),
    "tint.resolve": cmd<"tint.resolve">(tintResolveInput, (input) => tints.resolve(input)),
    "tint.customShade.save": cmd<"tint.customShade.save">(tintCustomShadeSaveInput, (input) =>
      tints.saveCustomShade(input),
    ),
    "tint.formula.saveVersion": cmd<"tint.formula.saveVersion">(tintSaveVersionInput, (input) =>
      tints.saveVersion(input),
    ),
    "tint.repeat.list": cmd<"tint.repeat.list">(tintRepeatListInput, (input) =>
      tints.repeatList(input),
    ),
    "tint.charges.list": cmd<"tint.charges.list">(none(), () => tints.listCharges()),
    "tint.charges.save": cmd<"tint.charges.save">(tintChargesSaveInput, (input) =>
      tints.saveCharges(input),
    ),
  };
}
