# B6 — Save and resume

Owner: Marat · Issue: [#6](https://github.com/loonaarc/backpack-brawl/issues/6) · Branch: `feat/b6-save-resume`

## What it does

- A browser refresh resumes the saved shop, battle or final result. **Continue run** opens the saved screen from the home page.
- Refreshing during a search returns to the same shop. The next search uses the same round, and the API returns a fixed opponent for that round.
- Refreshing during a battle shows its final frame. The same fight result is reflected in the run after every reload. The rules panel, search status and battle screen explain the refresh policy.

## How it works (code path)

1. [GameProvider](../../src/state/GameProvider.tsx) loads the save before the router renders. When the run changes, it writes the current checkpoint before displaying the new screen.
2. [save.ts](../../src/save.ts) reads a versioned JSON snapshot from `localStorage`. It checks the phase, score and round, gold budget, item IDs, slot counts and item instance IDs. A missing, invalid or unsupported snapshot opens the start screen.
3. The shop snapshot keeps the offers, including sold slots, the backpack order, gold, the next shop seed and the item counter. The provider saves a search as a shop checkpoint.
4. A battle snapshot keeps the run from before the battle and the accepted opponent. On refresh, [createBattleReplay and skipReplay](../../src/game.ts) rebuild the fight and settle it using that same pre-battle run. Each refresh starts from that checkpoint, so wins and losses never accumulate on repeat.
5. **Continue** saves the next shop or the finished run. The stable `runId` survives every phase and is available for B7.

## Decisions

- **Save the battle inputs.** The simulation is deterministic. Keeping the original run and opponent gives a compact checkpoint and avoids writing to storage for each frame.
- **Return to the shop during a search.** An in-flight request belongs to the closing page. The saved round and shop already contain everything needed to retry.
- **Version the format.** Changes to the schema or battle rules that would alter a restored result need a new version or a migration.

## Values / rules

| Item | Value |
|---|---|
| Storage key | `backpack-brawl:run` |
| Format version | `1` |
| Run ID | 16 random bytes represented by 32 lowercase hex characters |
| Battle refresh | Show the final frame of the same battle and apply its result to the saved pre-battle run |

## Verification

- [Unit tests](../../src/save.test.ts) cover the exact shop and next reroll, malformed and impossible snapshots, repeated refreshes of a losing replay and restoration of a finished run.
- In Chrome, refreshing after a purchase, move and reroll preserved the shop and run ID. Refreshing during matchmaking reopened the same shop, and refreshing a losing battle twice counted one loss.
- A finished run reopened on the result page. **Continue run** found it from the home page. A broken save returned to the start screen and allowed a new run.
- To reproduce the search check, start with `API_LATENCY=5000 npm run dev` in Git Bash, search for an opponent and refresh before the response. Retry and refresh again while the battle is playing.

## Known limitations

- The save is local to the browser profile and site origin. Tabs on the same origin share one save. If browser storage is disabled, the run can continue in memory for the current visit.
