import { buildOpponentFighter, buildPlayerFighter, simulateBattle } from "./battle";
import { applyBattleResult, newRun, runOutcome } from "./run";
import { itemIdsOf } from "./shop";
import type { BattleReplay, GameState, Opponent, RunState } from "./types";

/**
 * Phase transitions of one run: shop → searching → battle → shop … → finished.
 * Every function is pure, so they can be passed straight to `setState`.
 */

export function newGame(seed: number, runId: string): GameState {
  return { phase: "shop", run: newRun(seed, runId), search: null, battle: null, error: null };
}

/** Applies a shop/backpack action; only allowed while shopping. */
export function updateRun(game: GameState, action: (run: RunState) => RunState): GameState {
  if (game.phase !== "shop") return game;
  const run = action(game.run);
  return run === game.run ? game : { ...game, run };
}

/** Why the player can't look for an opponent right now, or `null` if they can. */
export function fightBlocker(game: GameState): string | null {
  if (game.phase === "searching") return "Opponent search is already running";
  if (game.phase !== "shop") return "You can only search from the shop";
  if (itemIdsOf(game.run.backpack).length === 0) return "Buy at least one item first";
  return null;
}

export function startSearch(game: GameState, id: number): GameState {
  if (fightBlocker(game) !== null) return game;
  return { ...game, phase: "searching", search: { id, round: game.run.round }, error: null };
}

function isCurrentSearch(game: GameState, id: number): boolean {
  return game.phase === "searching" && game.search?.id === id && game.search.round === game.run.round;
}

export function searchFailed(game: GameState, id: number, error: string): GameState {
  if (!isCurrentSearch(game, id)) return game;
  return { ...game, phase: "shop", search: null, error };
}

/** Accepts the current search's opponent and starts the battle replay. */
export function startBattle(game: GameState, id: number, opponent: Opponent): GameState {
  if (!isCurrentSearch(game, id)) return game;
  if (opponent.round !== game.run.round) {
    return searchFailed(game, id, "The arena returned an opponent for a different round.");
  }

  return { ...game, phase: "battle", search: null, battle: createBattleReplay(game.run, opponent) };
}

export function createBattleReplay(run: RunState, opponent: Opponent): BattleReplay {
  const player = buildPlayerFighter(run.backpack);
  const enemy = buildOpponentFighter(opponent);
  const result = simulateBattle(player, enemy);
  return { opponent, runBeforeBattle: run, player, enemy, result, frame: 0 };
}

export const isReplayDone = (battle: BattleReplay) => battle.frame >= battle.result.frames.length - 1;

/** Shows the given frame; reaching the last frame applies the battle result to the run (exactly once). */
export function showFrame(game: GameState, frame: number): GameState {
  const { battle } = game;
  if (game.phase !== "battle" || !battle || isReplayDone(battle)) return game;
  const last = battle.result.frames.length - 1;
  const next = { ...battle, frame: Math.min(Math.max(frame, battle.frame), last) };
  if (!isReplayDone(next)) return { ...game, battle: next };
  return { ...game, battle: next, run: applyBattleResult(game.run, battle.result.winner) };
}

export const advanceReplay = (game: GameState) => showFrame(game, (game.battle?.frame ?? 0) + 1);
export const skipReplay = (game: GameState) => showFrame(game, Infinity);

/** Leaves a finished replay: back to the shop, or to the end screen if the run is over. */
export function leaveBattle(game: GameState): GameState {
  if (game.phase !== "battle" || !game.battle || !isReplayDone(game.battle)) return game;
  return { ...game, phase: runOutcome(game.run) ? "finished" : "shop", battle: null };
}

/** URL paths of the app's screens. */
export const ROUTES = { start: "/", shop: "/shop", battle: "/battle", result: "/result", hallOfFame: "/hall-of-fame" } as const;
export type GameRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The screen that matches the game's phase. Shop, battle and result pages
 * redirect here when they don't match, so the URL always follows the phase.
 */
export function routeForGame(game: GameState | null): GameRoute {
  if (!game) return ROUTES.start;
  switch (game.phase) {
    case "shop":
    case "searching":
      return ROUTES.shop;
    case "battle":
      return ROUTES.battle;
    case "finished":
      return ROUTES.result;
  }
}
