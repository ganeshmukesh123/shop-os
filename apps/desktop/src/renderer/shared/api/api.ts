import type { CommandMap, CommandName } from "@shopos/core/commands";
import type { ErrorCode } from "@shopos/core";

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Call a main-process command; returns the data or throws ApiError with the contract's error code. */
export async function call<K extends CommandName>(
  name: K,
  input: CommandMap[K][0],
): Promise<CommandMap[K][1]> {
  const fn = window.shopos[name] as (commandInput: CommandMap[K][0]) => Promise<{
    ok: boolean;
    data?: CommandMap[K][1];
    code?: ErrorCode;
    message?: string;
    details?: unknown;
  }>;
  const commandResponse = await fn(input);
  if (commandResponse.ok) return commandResponse.data as CommandMap[K][1];
  throw new ApiError(
    commandResponse.code ?? "INTERNAL",
    commandResponse.message ?? "Something went wrong",
    commandResponse.details,
  );
}

export const messageOf = (caughtError: unknown): string =>
  caughtError instanceof Error ? caughtError.message : String(caughtError);
