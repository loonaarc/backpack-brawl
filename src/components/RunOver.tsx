import type { RunOutcome } from "../run";
import type { RunState } from "../types";
import { SubmitRunForm } from "./SubmitRunForm";

export function RunOver({ run, outcome, onNewRun }: { run: RunState; outcome: RunOutcome; onNewRun: () => void }) {
  const victory = outcome === "victory";
  return (
    <section
      className={`mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-lg border-2 bg-panel p-8 text-center ${victory ? "border-gold" : "border-life"}`}
    >
      <p className="text-6xl" aria-hidden>
        {victory ? "👑" : "🪦"}
      </p>
      <h2 className="font-display text-3xl font-bold">{victory ? "Champion of the arena!" : "Your run is over"}</h2>
      <p className="text-muted">
        {run.wins} {run.wins === 1 ? "win" : "wins"} in {run.round} {run.round === 1 ? "round" : "rounds"}, {run.lives}{" "}
        {run.lives === 1 ? "life" : "lives"} left.
      </p>
      <SubmitRunForm key={run.runId} run={run} outcome={outcome} />
      <button type="button" onClick={onNewRun} className="rounded-md bg-panel-edge px-5 py-2 font-display font-bold hover:brightness-110">
        🎒 New run
      </button>
    </section>
  );
}
