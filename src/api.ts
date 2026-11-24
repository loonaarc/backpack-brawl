import { isItemId } from "./items";
import { BACKPACK_SIZE } from "./shop";
import type { Opponent } from "./types";

export function isOpponent(value: unknown): value is Opponent {
  if (!value || typeof value !== "object") return false;
  const { id, name, icon, hp, round, items } = value as Partial<Opponent>;
  return typeof id === "string"
    && typeof name === "string"
    && typeof icon === "string"
    && typeof hp === "number" && Number.isFinite(hp) && hp > 0
    && typeof round === "number" && Number.isSafeInteger(round) && round > 0
    && Array.isArray(items) && items.length <= BACKPACK_SIZE
    && items.every(isItemId);
}

export async function fetchOpponent(round: number, signal?: AbortSignal): Promise<Opponent> {
  let response: Response;
  try {
    response = await fetch(`/api/opponents?round=${encodeURIComponent(round)}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Could not reach the arena.", { cause: error });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: unknown } | null)?.error;
    throw new Error(typeof message === "string" && message.trim() ? message : `Opponent search failed (${response.status}).`);
  }
  if (!isOpponent(body)) throw new Error("The arena returned an invalid opponent.");
  return body;
}
