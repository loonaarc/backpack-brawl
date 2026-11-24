import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchOpponent } from "../api";
import { newGame, searchFailed, startBattle, startSearch } from "../game";
import type { GameState } from "../types";
import { GameContext, type GameContextValue } from "./GameContext";

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);
const SEARCH_TIMEOUT_MS = 8000;

/** Holds the game state for all routes, so it survives navigating between pages. */
export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState | null>(null);
  const nextSearchId = useRef(1);
  const search = game?.search;

  const update = useCallback<GameContextValue["update"]>((transition) => {
    setGame((current) => (current ? transition(current) : current));
  }, []);

  function findOpponent() {
    const id = nextSearchId.current;
    nextSearchId.current += 1;
    update((current) => startSearch(current, id));
  }

  // Start the request once the game has accepted this search.
  useEffect(() => {
    if (!search) return;
    const { id, round } = search;
    const controller = new AbortController();

    function fail(message: string) {
      update((current) => searchFailed(current, id, message));
    }

    const timeout = setTimeout(() => {
      controller.abort();
      fail("The arena took too long to respond.");
    }, SEARCH_TIMEOUT_MS);

    async function requestOpponent() {
      try {
        const opponent = await fetchOpponent(round, controller.signal);
        if (controller.signal.aborted) return;
        update((current) => startBattle(current, id, opponent));
      } catch (error) {
        if (controller.signal.aborted) return;
        fail(error instanceof Error ? error.message : "Opponent search failed.");
      } finally {
        clearTimeout(timeout);
      }
    }

    void requestOpponent();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search, update]);

  const value: GameContextValue = { game, startNewRun: () => setGame(newGame(randomSeed())), findOpponent, update };

  return <GameContext value={value}>{children}</GameContext>;
}
