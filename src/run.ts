import { getItem } from "./items";
import { BACKPACK_SIZE, rollShop } from "./shop";
import type { RunState, Side } from "./types";

export const START_GOLD = 10;
export const START_LIVES = 3;
export const WINS_TO_VICTORY = 5;
export const GOLD_PER_ROUND = 5;
export const REROLL_COST = 1;

export function newRun(seed: number): RunState {
  const roll = rollShop(seed);
  return {
    round: 1,
    gold: START_GOLD,
    lives: START_LIVES,
    wins: 0,
    seed: roll.seed,
    shop: roll.offers,
    backpack: Array(BACKPACK_SIZE).fill(null),
    nextUid: 1,
  };
}

export function firstFreeSlot(state: RunState): number {
  return state.backpack.indexOf(null);
}

/** Why an offer can't be bought right now, or `null` if it can. */
export function buyBlocker(state: RunState, offerIndex: number): string | null {
  const itemId = state.shop[offerIndex];
  if (!itemId) return "Already sold";
  if (firstFreeSlot(state) === -1) return "Backpack is full";
  if (state.gold < getItem(itemId).price) return "Not enough gold";
  return null;
}

/** Buys a shop offer into the first free backpack slot; unchanged state if not allowed. */
export function buyItem(state: RunState, offerIndex: number): RunState {
  if (buyBlocker(state, offerIndex) !== null) return state;
  const itemId = state.shop[offerIndex]!;
  const slot = firstFreeSlot(state);
  const backpack = [...state.backpack];
  backpack[slot] = { uid: `item-${state.nextUid}`, itemId };
  const shop = [...state.shop];
  shop[offerIndex] = null;
  return { ...state, gold: state.gold - getItem(itemId).price, shop, backpack, nextUid: state.nextUid + 1 };
}

/** Gold you get back for selling an item: half its price, rounded down. */
export function sellPrice(itemId: string): number {
  return Math.floor(getItem(itemId).price / 2);
}

/** Why the item in a backpack slot can't be sold right now, or `null` if it can. */
export function sellBlocker(state: RunState, slot: number): string | null {
  if (!state.backpack[slot]) return "Nothing to sell";
  return null;
}

/**
 * Sells the item in a backpack slot: refunds `sellPrice` and frees the slot; unchanged state if not allowed.
 * The shop offer it was bought from stays sold for this round.
 */
export function sellItem(state: RunState, slot: number): RunState {
  if (sellBlocker(state, slot) !== null) return state;
  const item = state.backpack[slot]!;
  const backpack = [...state.backpack];
  backpack[slot] = null;
  return { ...state, gold: state.gold + sellPrice(item.itemId), backpack };
}

/** Why the shop can't be rerolled right now, or `null` if it can. */
export function rerollBlocker(state: RunState): string | null {
  if (state.gold < REROLL_COST) return "Not enough gold";
  return null;
}

/**
 * Pays `REROLL_COST` and replaces all shop offers (sold ones included) with a fresh roll from the run's seed;
 * unchanged state if not allowed. The seed advances, so the same run always rerolls to the same offers.
 */
export function rerollShop(state: RunState): RunState {
  if (rerollBlocker(state) !== null) return state;
  const roll = rollShop(state.seed);
  return { ...state, gold: state.gold - REROLL_COST, seed: roll.seed, shop: roll.offers };
}

export type RunOutcome = "victory" | "defeat";

/** `victory` / `defeat` once the run is over, otherwise `null`. */
export function runOutcome(state: RunState): RunOutcome | null {
  if (state.wins >= WINS_TO_VICTORY) return "victory";
  if (state.lives <= 0) return "defeat";
  return null;
}

/** Starts the next round: round + 1, round gold, fresh shop. The backpack is kept. */
export function startNextRound(state: RunState): RunState {
  const roll = rollShop(state.seed);
  return { ...state, round: state.round + 1, gold: state.gold + GOLD_PER_ROUND, seed: roll.seed, shop: roll.offers };
}

/** Records a battle (win → +1 win, loss → −1 life) and moves on to the next round unless the run is over. */
export function applyBattleResult(state: RunState, winner: Side): RunState {
  const scored = winner === "player" ? { ...state, wins: state.wins + 1 } : { ...state, lives: state.lives - 1 };
  return runOutcome(scored) ? scored : startNextRound(scored);
}
