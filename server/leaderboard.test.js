import { describe, expect, it } from "vitest";
import { rankEntries, validateSubmission } from "./leaderboard.js";

const defeat = {
  runId: "00000000000000000000000000000001",
  name: "Marat",
  outcome: "defeat",
  wins: 2,
  rounds: 5,
  lives: 0,
};
const victory = { ...defeat, outcome: "victory", wins: 5, rounds: 6, lives: 2 };

describe("hall of fame", () => {
  it("accepts finished wins and losses and trims the player's name", () => {
    expect(validateSubmission({ ...defeat, name: "  Marat  " })).toEqual({ entry: defeat });
    expect(validateSubmission(victory)).toEqual({ entry: victory });
  });

  it("rejects malformed submissions and impossible totals", () => {
    const invalid = [
      null,
      { ...defeat, runId: "missing" },
      { ...defeat, name: " " },
      { ...defeat, name: "a".repeat(25) },
      { ...defeat, name: "a\u0000b" },
      { ...defeat, outcome: "ongoing" },
      { ...defeat, wins: "2" },
      { ...defeat, rounds: 4 },
      { ...defeat, rounds: 4, lives: 1 },
      { ...victory, rounds: 7, wins: 4, lives: 0 },
    ];

    for (const submission of invalid) {
      expect(validateSubmission(submission)).toEqual({ error: expect.any(String) });
    }
  });

  it("ranks victories, wins, rounds and ties without changing the input order", () => {
    const entries = [
      { ...defeat, name: "First tied loss" },
      { ...victory, name: "Six-round victory" },
      { ...defeat, name: "Four-win loss", wins: 4, rounds: 7 },
      { ...victory, name: "Five-round victory", rounds: 5, lives: 3 },
      { ...defeat, name: "Second tied loss" },
    ];
    const original = [...entries];
    expect(rankEntries(entries)).toEqual([entries[3], entries[1], entries[2], entries[0], entries[4]]);
    expect(entries).toEqual(original);
  });
});
