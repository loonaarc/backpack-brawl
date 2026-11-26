# Qualitative goals

We chose three goals that fit how Backpack Brawl is used: a single-player browser game that keeps a run going over many minutes, talks to a slow local API, and is reloaded at any time. A fourth goal applies to us as a team: we have to explain every part of the code in the exam.

| # | Goal | In one sentence |
|---|---|---|
| Q1 | Integrity of game state | Gold, items and results can never be corrupted, duplicated or applied twice. |
| Q2 | Robustness at the boundaries | Slow or failed requests, broken saves and bad input never break the game. |
| Q3 | Understandability | Players understand every rule, and each of us can explain every part of the code. |

---

## Q1 — Integrity of game state

**Why it matters:** the run is the player's progress. A lost item, negative gold or a battle counted twice would make the game unfair and confusing. Several requirements state this explicitly:
- B1: "never lost or duplicated", "completes fully or changes nothing"
- B5: "never apply a result twice"
- B6: no free reroll or avoided loss through refreshing

**Decisions and trade-offs:**
- **All rules are pure functions** in `run.ts`, `battle.ts` and `game.ts`. They take a state and return a new one, without changing the old one, so there's never a half-finished state. The trade-off is a bit more code than mutating the state directly.
- **One blocker per action** (`buyBlocker`, `sellBlocker`, `rerollBlocker`, `moveBlocker`, `fightBlocker`). The UI uses it to disable the button and show the reason, and the action checks it again before doing anything. The UI and the rule can't disagree. ([B1](features/B1-shop-economy.md), [B2](features/B2-backpack-arrangement.md))
- **One central phase gate:** `updateRun` only allows shop and backpack actions in the `shop` phase.
- **A search id for every attempt:** a late or duplicate reply is ignored if its id or round doesn't match the current search. ([B5](features/B5-resilient-matchmaking.md))
- **Battles are deterministic.** The simulation is computed in full first and the result is applied exactly once, on the last frame. B6 relies on this: after a refresh it re-simulates from the pre-battle run instead of storing the result, so refreshing can't change the outcome. ([B6](features/B6-save-resume.md))
- **All randomness is seeded** (`run.seed`). A reroll or refresh can't produce a different shop or opponent.

**How we check it:**
- **Unit tests:**
  - `run.test.ts`: a full backpack, selling, a reroll at 0 gold, and moves that lose no items
  - `game.test.ts`: a second search is blocked, stale replies are ignored, a result is applied once
  - `save.test.ts`: refreshing a lost battle twice counts one loss
- **Manual checks:** double click on "Find opponent" sends one request; refreshing during a battle gives the same result (see the B5 and B6 docs).
- **Status:** all checks pass.

## Q2 — Robustness at the boundaries

**Why it matters:** the game depends on three things it doesn't control:
- the API, which is deliberately slow and can fail
- `localStorage`, which a player can edit, which can come from an older version, or which can be disabled
- data sent to the hall of fame, which can be invalid or faked

Any of these must never leave the player stuck on a broken screen.

**Decisions and trade-offs:**
- **Validate at every boundary, not deep inside the logic:**
  - `api.ts` checks the opponent response's shape and item ids
  - `save.ts` checks a versioned snapshot: phase, score, gold, item ids and slots
  - `server/leaderboard.js` checks every submitted run against the game rules

  The rest of the code can then trust its inputs. The trade-off is that the validation code must be kept in sync when the state shape changes. That's why the save format has a version number.
- **Fall back to a playable state:**
  - a failed or timed-out search (8 s) returns to the same shop with a message and allows a retry
  - an invalid save opens the start screen
  - disabled storage keeps the run in memory
- **Retries are safe:** the hall of fame keeps one entry per `runId`, so resubmitting after a lost response returns the stored entry instead of creating a duplicate. ([B7](features/B7-hall-of-fame.md))

**How we check it:**
- **Unit tests:**
  - `save.test.ts`: malformed and impossible snapshots
  - `server/leaderboard.test.js`: invalid scores
  - `game.test.ts`: recovery after a failure
- **Manual and HTTP checks:**
  - `?fail=true`, `?latency=5000`, `API_FAIL=true`, and a stopped API server
  - a broken save in `localStorage`
  - invalid JSON and concurrent duplicate submissions to the leaderboard API
- **Status:** all checks pass. Known limit: the API can only check that a score is *possible*, not that it was really played, because the server never sees the battles.

## Q3 — Understandability

**Why it matters:**
- **Players:** the game must explain its mechanics in the interface (B3 and B4 explicitly require explanations in the rules panel and tooltips).
- **Us:** the professor values "appropriate and understandable implementations" over complexity, and both of us must navigate and explain all of the code without tools.

**Decisions and trade-offs:**
- **Rule texts are generated from the constants** (`rules.ts`, `describeEffects`, `describeSetBonus`). Changing a value like `POISON_INTERVAL` updates the explanation automatically, so the texts can't go stale.
- **`EFFECT_HELP` is a `Record<keyof ItemEffects, string>`.** TypeScript refuses to compile if a new effect has no tooltip.
- **Logic is separate from the UI.** Components only display state and call rule functions, so each rule can be read and tested in one place.
- **Simple mechanisms over clever ones**, each with a simpler alternative we gave up:
  - Set bonuses are applied once in `buildFighter`, not inside the simulation. ([B4](features/B4-item-sets-burn.md))
  - Arranging uses two clicks instead of drag and drop. ([B2](features/B2-backpack-arrangement.md))
  - The hall of fame is an in-memory map instead of a database. ([B7](features/B7-hall-of-fame.md))
- **One doc per feature** (`docs/features/`). Each describes the code path, decisions, values and verification, and serves as study material for the exam.
- **Tests only where they add value.** We decided per issue, so there are 30 short tests in total, focused on rules that are hard to check by hand.

**How we check it:**
- Every mechanic appears in the rules panel and has a tooltip (manual check per feature, listed in each doc).
- `npm run check` (lint, tests, build) runs in CI on every push.
- Before the exam, each of us explains the other's features from the feature doc alone.
- **Status:** rules panel and tooltips are done; the mutual explanation session is still to do.

---

## Goals we considered but didn't choose

- **Performance:** the game is small (one battle has at most 60 ticks), so there was nothing worth optimising.
- **Security beyond validation:** there are no accounts or real data. We limited this to input validation in the API (Q2).
- **Accessibility:** we kept the starter's semantics (buttons, `aria-label`s, keyboard: Esc cancels a selection). We didn't make it a goal because we couldn't test it with assistive technology.
