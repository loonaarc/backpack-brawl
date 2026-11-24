import { createContext, useContext } from "react";
import type { GameState } from "../types";

export interface GameContextValue {
  /** The current run, or `null` before the first run was started. */
  game: GameState | null;
  /** Throws away the current run (if any) and starts a fresh one. */
  startNewRun: () => void;
  /** Looks for an opponent if the current run can start a search. */
  findOpponent: () => void;
  /** Applies a pure transition from game.ts to the current run; ignored without a run. */
  update: (transition: (game: GameState) => GameState) => void;
}

export const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside <GameProvider>");
  return context;
}

/** Like `useGame`, for pages that are only reachable with a run in progress (see `RequireRoute`). */
export function useActiveGame(): GameContextValue & { game: GameState } {
  const context = useGame();
  if (!context.game) throw new Error("No run in progress");
  return { ...context, game: context.game };
}
