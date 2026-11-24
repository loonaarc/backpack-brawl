# B7 — Hall of Fame

Owner: Marat · Issue: [#7](https://github.com/loonaarc/backpack-brawl/issues/7) · Branch: `feat/b7-hall-of-fame`

## What it does

- A finished run can be submitted under a player name from the result screen. The form keeps the name when a request fails.
- The **Hall of Fame** page is available from the navigation. It shows scores or a loading, empty or retry state.
- The API keeps one entry per run. After a refresh, a recorded run shows its confirmation on the result screen.

## How it works (code path)

1. [SubmitRunForm](../../src/components/SubmitRunForm.tsx) looks up the current `runId`. If it is new, the form sends the name and final score using [leaderboard.ts](../../src/leaderboard.ts).
2. [server/index.js](../../server/index.js) validates the payload using [leaderboard.js](../../server/leaderboard.js). A map keyed by `runId` keeps the first accepted entry.
3. [HallOfFamePage](../../src/pages/HallOfFamePage.tsx) loads the ranked entries from the same API and shows the ranking criteria.

## Decisions

- **Keep the original entry on retry.** If the API saves a result and the response is lost, the retry returns the stored entry. The result screen checks the API on load, using the ID preserved by B6.
- **Check the final score against the game rules.** Every round either adds a win or uses a life. The API checks the totals and the conditions for victory or defeat.
- **Keep one in-memory table.** The API can serve the hall of fame without a database. Earlier entries win score ties.

## Values / rules

| Rule | Value |
|---|---|
| Page | `/hall-of-fame` |
| API | [GET and POST /api/leaderboard](../API.md#get-apileaderboard) |
| Name | 1–24 characters after trimming |
| Sorting | Victories, more wins, fewer rounds, earlier submissions |

## Verification

- [Server unit tests](../../server/leaderboard.test.js) cover valid results, invalid results and stable ranking.
- HTTP checks covered invalid JSON, invalid scores, ranking, lookup and concurrent duplicate submissions. Two requests for the same ID produced one entry.
- In Chrome, the hall showed loading, error, retry and empty states. After a simulated lost submission response, the name stayed in the form and the retry returned the existing entry. Refreshing the result showed the confirmation and the table still had one row.

## Known limitations

- Restarting the API clears the table and its recorded run IDs. The API checks that the score is possible from the totals the client sends.
