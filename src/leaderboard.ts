import type { RunOutcome } from "./run";

export interface LeaderboardEntry {
  runId: string;
  name: string;
  outcome: RunOutcome;
  wins: number;
  rounds: number;
  lives: number;
}

export const MAX_NAME_LENGTH = 24;

function isEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") return false;
  const { runId, name, outcome, wins, rounds, lives } = value as Partial<LeaderboardEntry>;
  return typeof runId === "string" && typeof name === "string"
    && (outcome === "victory" || outcome === "defeat")
    && Number.isSafeInteger(wins) && Number.isSafeInteger(rounds) && Number.isSafeInteger(lives);
}

async function requestLeaderboard(path: string, options?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { ...options, signal: AbortSignal.timeout(8000) });
  } catch (cause) {
    throw new Error("Could not reach the hall of fame. Try again.", { cause });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: unknown } | null)?.error;
    throw new Error(typeof message === "string" ? message : `Hall of fame request failed (${response.status}).`);
  }
  return body;
}

export async function fetchLeaderboard(runId?: string): Promise<LeaderboardEntry[]> {
  const path = runId === undefined ? "/api/leaderboard" : `/api/leaderboard?runId=${encodeURIComponent(runId)}`;
  const body = await requestLeaderboard(path);
  if (!Array.isArray(body) || !body.every(isEntry)) throw new Error("The hall of fame returned invalid results.");
  return body;
}

export async function submitRun(entry: LeaderboardEntry): Promise<LeaderboardEntry> {
  const body = await requestLeaderboard("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!isEntry(body) || body.runId !== entry.runId) throw new Error("The hall of fame did not confirm this run.");
  return body;
}
