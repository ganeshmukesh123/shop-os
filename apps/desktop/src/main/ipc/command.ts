import { ZodError, type ZodTypeAny } from "zod";
import { CoreError, type CommandMap, type CommandName, type Result } from "@shopos/core";

/** How every handler runs: validate with the command's schema, run, and turn errors into results. */
export const none = (): ZodTypeAny => ({ parse: (rawInput: unknown) => rawInput }) as ZodTypeAny;

export function toFailure(caughtError: unknown): Extract<Result<never>, { ok: false }> {
  if (caughtError instanceof CoreError)
    return {
      ok: false,
      code: caughtError.code,
      message: caughtError.message,
      details: caughtError.details,
    };
  if (caughtError instanceof ZodError) {
    return {
      ok: false,
      code: "INVALID_FIELD",
      message: caughtError.issues.map((validationIssue) => validationIssue.message).join("; "),
    };
  }
  console.error("Unexpected error in command", caughtError);
  return {
    ok: false,
    code: "INTERNAL",
    message: "Something went wrong. Nothing was lost; please try again.",
  };
}

export function cmd<K extends CommandName>(
  schema: ZodTypeAny,
  run: (input: never) => Promise<CommandMap[K][1]> | CommandMap[K][1],
) {
  return async (raw: unknown): Promise<Result<CommandMap[K][1]>> => {
    try {
      const input = schema.parse(raw);
      return { ok: true, data: await run(input as never) };
    } catch (caughtError) {
      return toFailure(caughtError);
    }
  };
}
