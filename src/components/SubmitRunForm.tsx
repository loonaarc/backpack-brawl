import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ROUTES } from "../game";
import { fetchLeaderboard, MAX_NAME_LENGTH, submitRun, type LeaderboardEntry } from "../leaderboard";
import type { RunOutcome } from "../run";
import type { RunState } from "../types";

type Submission =
  | { status: "checking" }
  | { status: "ready"; error?: string }
  | { status: "saving" }
  | { status: "saved"; entry: LeaderboardEntry };

export function SubmitRunForm({ run, outcome }: { run: RunState; outcome: RunOutcome }) {
  const [name, setName] = useState("");
  const [submission, setSubmission] = useState<Submission>({ status: "checking" });
  const submitted = useRef(false);
  const { runId, round, lives, wins } = run;

  useEffect(() => {
    let active = true;
    async function checkSubmission() {
      try {
        const entries = await fetchLeaderboard(runId);
        if (!active) return;
        const entry = entries.find((item) => item.runId === runId);
        setSubmission(entry ? { status: "saved", entry } : { status: "ready" });
      } catch {
        if (active) setSubmission({ status: "ready", error: "Could not check this run. You can still submit it." });
      }
    }

    void checkSubmission();
    return () => { active = false; };
  }, [runId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (submitted.current || submission.status !== "ready" || !trimmedName) return;
    submitted.current = true;
    setSubmission({ status: "saving" });
    try {
      const entry = await submitRun({ runId, name: trimmedName, outcome, wins, lives, rounds: round });
      setSubmission({ status: "saved", entry });
    } catch (error) {
      submitted.current = false;
      setSubmission({
        status: "ready",
        error: error instanceof Error ? error.message : "Could not submit this run. Try again.",
      });
    }
  }

  if (submission.status === "checking") return <p role="status" className="text-sm text-muted">Checking the hall of fame…</p>;
  if (submission.status === "saved") {
    return (
      <div className="space-y-1">
        <p role="status">Run recorded as <strong>{submission.entry.name}</strong>.</p>
        <Link to={ROUTES.hallOfFame} className="text-sm text-gold underline">View Hall of Fame</Link>
      </div>
    );
  }

  const saving = submission.status === "saving";
  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-2 text-left">
      <label htmlFor="hall-of-fame-name" className="text-sm font-bold">Name for the Hall of Fame</label>
      <input
        id="hall-of-fame-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={MAX_NAME_LENGTH}
        required
        disabled={saving}
        className="w-full rounded-md border border-panel-edge bg-ink px-3 py-2"
      />
      {submission.status === "ready" && submission.error && <p role="alert" className="text-sm text-life">{submission.error}</p>}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="rounded-md bg-gold px-4 py-2 font-bold text-ink hover:brightness-110 disabled:opacity-50"
      >
        {saving ? "Submitting…" : "Submit run"}
      </button>
    </form>
  );
}
