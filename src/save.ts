import { isOpponent } from "./api";
import { createBattleReplay, skipReplay } from "./game";
import { CATALOG, getItem, isItemId } from "./items";
import { GOLD_PER_ROUND, runOutcome, sellPrice, START_GOLD, START_LIVES, WINS_TO_VICTORY } from "./run";
import { BACKPACK_SIZE, SHOP_SIZE } from "./shop";
import type { GameState, Opponent, Phase, RunState } from "./types";

export const SAVE_KEY = "backpack-brawl:run";
const SAVE_VERSION = 1;
const MAX_ROUND = WINS_TO_VICTORY + START_LIVES - 1;
const MIN_SPENT_PER_SALE = Math.min(...CATALOG.map((item) => item.price - sellPrice(item.id)));

type SavedPhase = Exclude<Phase, "searching">;

interface SavedRun {
  phase: SavedPhase;
  run: RunState;
  opponent?: Opponent;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isSavedRun(value: unknown): value is RunState {
  if (!value || typeof value !== "object") return false;
  const { runId, round, gold, lives, wins, seed, shop, backpack, nextUid } = value as Partial<RunState>;
  if (typeof runId !== "string" || !/^[0-9a-f]{32}$/.test(runId)) return false;
  if (!isIntegerInRange(round, 1, MAX_ROUND) || !isIntegerInRange(lives, 0, START_LIVES)
    || !isIntegerInRange(wins, 0, WINS_TO_VICTORY) || !isIntegerInRange(seed, 0, 2 ** 32 - 1)) return false;

  const completedRounds = wins + START_LIVES - lives;
  const finished = wins === WINS_TO_VICTORY || lives === 0;
  if (wins === WINS_TO_VICTORY && lives === 0) return false;
  if (round !== completedRounds + (finished ? 0 : 1)) return false;

  const earned = START_GOLD + GOLD_PER_ROUND * (round - 1);
  if (!isIntegerInRange(gold, 0, earned) || !isIntegerInRange(nextUid, 1, earned + 1)) return false;
  if (!Array.isArray(shop) || shop.length !== SHOP_SIZE || !shop.every((id) => id === null || isItemId(id))) return false;
  if (!Array.isArray(backpack) || backpack.length !== BACKPACK_SIZE) return false;

  const purchases = nextUid - 1;
  if (shop.filter((id) => id === null).length > purchases) return false;

  const uids = new Set<string>();
  let ownedValue = 0;
  for (const slot of backpack) {
    if (slot === null) continue;
    if (!slot || typeof slot !== "object" || typeof slot.uid !== "string" || !isItemId(slot.itemId)) return false;
    const uid = /^item-([1-9]\d*)$/.exec(slot.uid);
    if (!uid || Number(uid[1]) >= nextUid || uids.has(slot.uid)) return false;
    uids.add(slot.uid);
    ownedValue += getItem(slot.itemId).price;
  }

  // Every sold item spent at least the difference between its purchase price and refund.
  const spentOnSales = (purchases - uids.size) * MIN_SPENT_PER_SALE;
  return gold + ownedValue + spentOnSales <= earned;
}

export function restoreGame(json: string | null): GameState | null {
  if (json === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;

  const { version, phase, run, opponent } = value as Partial<SavedRun> & { version?: unknown };
  if (version !== SAVE_VERSION || !isSavedRun(run)) return null;
  if (phase !== "shop" && phase !== "battle" && phase !== "finished") return null;
  if ((phase === "finished") !== (runOutcome(run) !== null)) return null;
  if (phase !== "shop" && run.backpack.every((slot) => slot === null)) return null;

  const game: GameState = { phase, run, search: null, battle: null, error: null };
  if (phase !== "battle") return opponent === undefined ? game : null;
  if (!isOpponent(opponent) || opponent.round !== run.round) return null;

  // Each reload starts from the saved pre-battle run, so the score cannot accumulate.
  return skipReplay({ ...game, battle: createBattleReplay(run, opponent) });
}

export function loadGame(): GameState | null {
  try {
    return restoreGame(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function saveGame(save: SavedRun): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, ...save }));
  } catch {
    // Discard a stale snapshot if possible so a failed write cannot roll the run back.
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Storage can be disabled. The game can still continue in memory.
    }
  }
}
