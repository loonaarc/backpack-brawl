import { useEffect, useState } from "react";
import { fetchLeaderboard, type LeaderboardEntry } from "../leaderboard";

type Scoreboard =
  | { status: "loading" }
  | { status: "loaded"; entries: LeaderboardEntry[] }
  | { status: "error"; message: string };

export function HallOfFamePage() {
  const [board, setBoard] = useState<Scoreboard>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadEntries() {
      try {
        const entries = await fetchLeaderboard();
        if (active) setBoard({ status: "loaded", entries });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load the hall of fame.";
        if (active) setBoard({ status: "error", message });
      }
    }

    void loadEntries();
    return () => { active = false; };
  }, [attempt]);

  function retry() {
    setBoard({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 rounded-lg border border-panel-edge bg-panel p-4 sm:p-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-bold text-gold">Hall of Fame</h2>
        <p className="text-sm text-muted">Victories first, then most wins, then fewest rounds. Earlier entries win ties.</p>
      </header>
      {board.status === "loading" && <p role="status" className="text-muted">Loading scores…</p>}
      {board.status === "error" && (
        <div className="space-y-2">
          <p role="alert" className="text-life">{board.message}</p>
          <button type="button" onClick={retry} className="rounded-md bg-gold px-3 py-1.5 font-bold text-ink">Try again</button>
        </div>
      )}
      {board.status === "loaded" && board.entries.length === 0 && <p className="text-muted">No runs recorded yet.</p>}
      {board.status === "loaded" && board.entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Run rankings</caption>
            <thead className="border-b border-panel-edge text-muted">
              <tr>
                <th scope="col" className="p-2">Rank</th>
                <th scope="col" className="p-2">Player</th>
                <th scope="col" className="p-2">Result</th>
                <th scope="col" className="p-2 text-right">Wins</th>
                <th scope="col" className="p-2 text-right">Rounds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-edge">
              {board.entries.map((entry, index) => (
                <tr key={entry.runId}>
                  <td className="p-2 tabular-nums">{index + 1}</td>
                  <th scope="row" className="p-2 font-medium">{entry.name}</th>
                  <td className={`p-2 ${entry.outcome === "victory" ? "text-gold" : "text-muted"}`}>
                    {entry.outcome === "victory" ? "Victory" : "Defeat"}
                  </td>
                  <td className="p-2 text-right tabular-nums">{entry.wins}</td>
                  <td className="p-2 text-right tabular-nums">{entry.rounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
