import { useEffect } from "react";
import { BattleView } from "../components/BattleView";
import { RunHeader } from "../components/RunHeader";
import { advanceReplay, isReplayDone, leaveBattle, skipReplay } from "../game";
import { REFRESH_HELP } from "../rules";
import { runOutcome } from "../run";
import { useActiveGame } from "../state/GameContext";

/** Milliseconds between two replayed battle frames. */
const REPLAY_FRAME_MS = 250;

export function BattlePage() {
  const { game, update } = useActiveGame();
  const { battle, run } = game;
  const done = battle !== null && isReplayDone(battle);

  // Replay: show the next frame every REPLAY_FRAME_MS until the last one (which applies the result).
  useEffect(() => {
    if (!battle || done) return;
    const timer = setTimeout(() => update(advanceReplay), REPLAY_FRAME_MS);
    return () => clearTimeout(timer);
  }, [battle, done, update]);

  if (!battle) return null;
  const outcome = runOutcome(run);

  // Leaving the battle changes the phase; RequireRoute then redirects to the shop or result page.
  return (
    <>
      <RunHeader run={run} />
      {!done && <p className="text-sm text-muted">{REFRESH_HELP.battle}</p>}
      <BattleView
        battle={battle}
        done={done}
        continueLabel={outcome ? "See the final result" : `On to round ${run.round} 🏪`}
        onSkip={() => update(skipReplay)}
        onContinue={() => update(leaveBattle)}
      />
    </>
  );
}
