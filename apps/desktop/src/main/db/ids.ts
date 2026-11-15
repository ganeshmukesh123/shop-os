import { v7 as uuidv7 } from "uuid";

export const newId = (): string => uuidv7();
export const nowIso = (): string => new Date().toISOString();
/** The current UTC instant as epoch milliseconds: what created_at and updated_at store. */
export const nowMs = (): number => Date.now();
/** A stored instant (epoch milliseconds) as ISO-8601 UTC text, for the fields the app shows as text. */
export const isoOfMs = (instantMs: number): string => new Date(instantMs).toISOString();
