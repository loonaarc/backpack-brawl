// Match START_LIVES and WINS_TO_VICTORY in src/run.ts.
const START_LIVES = 3;
const WINS_TO_VICTORY = 5;
const MAX_ROUNDS = WINS_TO_VICTORY + START_LIVES - 1;
const MAX_NAME_LENGTH = 24;

export function isRunId(value) {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

function inRange(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function validateSubmission(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Send a JSON object with the finished run." };
  }

  const { runId, outcome, wins, rounds, lives } = body;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isRunId(runId)) return { error: "Run ID must be 32 lowercase hexadecimal characters." };
  if (!name || name.length > MAX_NAME_LENGTH || /\p{Cc}/u.test(name)) {
    return { error: `Enter a name with 1 to ${MAX_NAME_LENGTH} characters and no control characters.` };
  }
  if (outcome !== "victory" && outcome !== "defeat") {
    return { error: "Outcome must be victory or defeat." };
  }
  if (!inRange(wins, 0, WINS_TO_VICTORY) || !inRange(rounds, 1, MAX_ROUNDS) || !inRange(lives, 0, START_LIVES)) {
    return { error: "Wins, rounds and lives must be whole numbers within the game limits." };
  }
  if (rounds !== wins + START_LIVES - lives) {
    return { error: "Rounds must equal wins plus lives lost." };
  }
  if (outcome === "victory" && (wins !== WINS_TO_VICTORY || lives === 0)) {
    return { error: "A victory requires five wins and at least one life left." };
  }
  if (outcome === "defeat" && (lives !== 0 || wins === WINS_TO_VICTORY)) {
    return { error: "A defeat requires zero lives and fewer than five wins." };
  }

  return { entry: { runId, name, outcome, wins, rounds, lives } };
}

/** Sort is stable. Input order keeps earlier submissions first in a tie. */
export function rankEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.outcome !== b.outcome) return a.outcome === "victory" ? -1 : 1;
    return b.wins - a.wins || a.rounds - b.rounds;
  });
}
