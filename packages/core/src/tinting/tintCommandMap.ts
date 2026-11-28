import type { ITintFormula } from "./resolveTintFormula";
import type {
  ITintChargeRow,
  ITintShade,
  TintChargesSaveInput,
  TintCustomShadeSaveInput,
  TintRepeatListInput,
  TintResolveInput,
  TintSaveVersionInput,
  TintShadesSearchInput,
} from "./tintCommands";
import type { ITintRepeat, ITintResolved } from "./tintResults";

type NoInput = Record<string, never>;

/** The tint.* commands of spec 002 (contracts/ipc-commands.md, US3). */
export interface ITintCommandMap {
  "tint.shades.search": [TintShadesSearchInput, { shades: ITintShade[] }];
  "tint.resolve": [TintResolveInput, ITintResolved];
  "tint.customShade.save": [TintCustomShadeSaveInput, { shade: ITintShade; formula: ITintFormula }];
  "tint.formula.saveVersion": [TintSaveVersionInput, { formula: ITintFormula }];
  "tint.repeat.list": [TintRepeatListInput, { shades: ITintRepeat[] }];
  "tint.charges.list": [NoInput, { rules: ITintChargeRow[] }];
  "tint.charges.save": [TintChargesSaveInput, { rules: ITintChargeRow[] }];
}

export const TINT_COMMAND_NAMES = [
  "tint.shades.search",
  "tint.resolve",
  "tint.customShade.save",
  "tint.formula.saveVersion",
  "tint.repeat.list",
  "tint.charges.list",
  "tint.charges.save",
] as const satisfies readonly (keyof ITintCommandMap)[];
