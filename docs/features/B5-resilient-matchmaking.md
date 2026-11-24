# B5 — Resilient matchmaking

Owner: Marat · Issue: [#5](https://github.com/loonaarc/backpack-brawl/issues/5) · Branch: `feat/b5-resilient-matchmaking`

## What it does

- **Find opponent** starts a search from the shop when the backpack contains an item. The button shows **Searching…** and the shop and backpack stay locked until the search ends.
- A failed request, an invalid opponent or a timeout brings the player back to the same shop with an error. Gold, items, offers and the round are preserved, and the player can retry.
- Only the active search can start a battle for its round. A late reply cannot restart a battle or change a later run.

## How it works (code path)

1. [ShopPage](../../src/pages/ShopPage.tsx) calls `findOpponent` in [GameProvider](../../src/state/GameProvider.tsx). The provider gives each attempt an increasing ID, including across new runs.
2. In [game.ts](../../src/game.ts), `startSearch` calls `fightBlocker` and records `{ id, round }` if the action is allowed. The button uses the same blocker. A second click during the search leaves state unchanged.
3. Once the active search is in state, the provider effect calls `fetchOpponent` in [api.ts](../../src/api.ts). The API client checks the response shape and the opponent's item IDs before handing it to the game.
4. `startBattle` and `searchFailed` check the search ID and round against the current state. A valid reply clears the search and starts the battle. A reply for the wrong round or an error from the current attempt clears the search and unlocks the shop. Replies from earlier attempts leave the state unchanged.
5. The existing replay applies the result on its final frame. Reaching that frame again leaves the run unchanged.

## Decisions

- **One ID per attempt.** A retry can happen in the same round. The ID distinguishes the two requests and lets the state transition ignore a late reply.
- **The provider starts the request after the transition.** If two clicks are queued, the game can accept only the first transition. The provider also owns the request across routes and cancels it when the search is discarded.
- **The shop is available after an error.** Players can edit the current build or retry with the same items and offers.

## Values / rules

| Rule | Value |
|---|---|
| Client timeout | 8 seconds, including reading the response |
| Maximum simulated API delay | 5 seconds |
| Active search | One attempt ID and its round |

## Verification

- [Unit tests](../../src/game.test.ts) cover a blocked second search, recovery without changing the run, stale replies during a retry, a reply for the wrong round and a result applied once.
- The local API passed checks for `fail=true`, `latency=5000`, `API_FAIL=true` and an unavailable server.
- In Chrome, a double click sent one request. An HTTP 503 and an eight-second timeout both reopened the same shop. A retry with a five-second API delay opened the round 1 battle.
- To check the API directly, request `/api/opponents?round=1&fail=true` for a 503 and `/api/opponents?round=1&latency=5000` for a delayed 200.
- For the shop flow, run the frontend and API in separate terminals with `npm exec vite` and `API_FAIL=true npm run server` in Git Bash. Start a run, buy an item and search. The shop should unlock after the error. Restart only the API with `API_LATENCY=5000 npm run server` and retry in the same browser tab. The search button should stay disabled until the round 1 battle opens.

## Known limitations

- Refreshing ends the active request. [B6](B6-save-resume.md) explains how the player returns to the same shop.
