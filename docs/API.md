# Backpack Brawl API

The local API is a small Express server in `server/index.js`. It listens on port 4200 (override with the `PORT` environment variable). During Vite development, `/api` is proxied to it, so the frontend uses relative URLs such as `/api/opponents?round=1`. The leaderboard is stored in memory and clears when the API restarts.

## `GET /api/health`

Always answers immediately with status 200:

```json
{ "ok": true, "service": "backpack-brawl" }
```

## `GET /api/opponents`

Returns the opponent for one round of a run. The opponent table lives in `server/opponents.js`.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `round` | yes | The 1-based round number. Must be a positive whole number written in digits (`1`, `2`, …). |
| `latency` | no | Response delay in milliseconds, clamped to 0–5000. Defaults to 1200. A value that is not a number falls back to the default. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Success — 200

```json
{
  "id": "mossback-hermit",
  "name": "Mossback Hermit",
  "icon": "🐢",
  "hp": 25,
  "items": ["chipped-dagger", "pot-lid"],
  "round": 1
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier of the opponent |
| `name` | string | Display name |
| `icon` | string | Emoji shown in the battle view |
| `hp` | number | Maximum (and starting) HP |
| `items` | string[] | Item ids from the catalog in `src/items.ts`; the same id may appear several times |
| `round` | number | The round this opponent was requested for (echoes `round`) |

The response matches the `Opponent` type in `src/types.ts`.

The answer is deterministic: the same `round` always returns the same opponent. There is one hand-built opponent per round for rounds 1–7. Every round past the table returns the last opponent with +6 HP per additional round. The table never needs more than 7 rounds (5 wins + 3 lives − 1), and an opponent never carries more than 6 items, the size of the player's 2×3 backpack.

### Errors

Every error response has the shape:

```json
{ "error": "human-readable explanation" }
```

| Status | When | `error` |
|---|---|---|
| 400 | `round` is missing, not a whole number, or less than 1 | `round must be a positive whole number` |
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The arena gates are shut. No challenger answered the call.` |

An invalid `round` is reported as 400 even when failure is forced. All responses from this endpoint, errors included, arrive after the configured delay.

## `GET /api/leaderboard`

Returns **200** and a JSON array of entries in rank order. Victories come first, followed by higher win counts and fewer rounds. Equal scores retain submission order. An empty board returns `[]`.

An optional `runId` query parameter looks up one run. The response is either `[entry]` or `[]`. An invalid ID returns **400**.

## `POST /api/leaderboard`

Send a finished run as `application/json`. The response entry has the same fields as the request.

```json
{
  "runId": "00000000000000000000000000000001",
  "name": "Arena Hero",
  "outcome": "victory",
  "wins": 5,
  "rounds": 6,
  "lives": 2
}
```

| Field | Validation |
|---|---|
| `runId` | 32 lowercase hexadecimal characters, generated once per run |
| `name` | 1–24 characters after trimming, with no embedded control characters |
| `outcome` | `victory` or `defeat` |
| `wins`, `rounds`, `lives` | Whole numbers with `rounds = wins + 3 − lives`. A victory has exactly 5 wins and 1–3 lives. A defeat has 0–4 wins and 0 lives. |

**201** returns the newly recorded entry. A repeat with the same `runId` and a valid payload returns **200** with the first accepted entry. This keeps one result even if the first response was lost.

Invalid data or malformed JSON returns **400** with `{ "error": "human-readable explanation" }`. Bodies over 4 KB return **413**. A missing or unsupported content type, charset or content encoding returns **415**.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 4200). The Vite proxy expects 4200. |
| `API_LATENCY` | Default delay in milliseconds when a request has no `latency` parameter. |
| `API_FAIL` | `true` makes every opponent request fail with 503. |

Example: `API_FAIL=true pnpm server`.

## Client

`fetchOpponent(round, signal?)` in `src/api.ts` validates the opponent response and accepts an optional abort signal. It reports HTTP errors using the server's message when available, with a status-code fallback. Network failures and invalid opponent data produce their own errors. The game cancels a search after 8 seconds and lets the player retry from the same shop.
