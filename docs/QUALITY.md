# Qualitative goals

TBD together. Pick about 3; each needs a reason, the decisions that support it, and how we check it.

| Goal | Why it matters here | How we support it | How we check it |
|---|---|---|---|
| Integrity of game state | Gold, items and results must never be corrupted (B1, B5, B6) | Pure rule functions with guards; one `…Blocker` per action shared by UI and logic | Invariant unit tests |
| Robustness | Slow/failed API, malformed saves, refresh at any time (B5, B6, B7) | Validation at every boundary (API input, localStorage) | Tests with bad input; manual runs with `?fail=true`, `?latency=5000` |
| Understandability | Players must understand the rules; we must explain the code in the exam | Rules text generated from constants; logic separate from UI | Every mechanic appears in the rules panel; checked in PR review |
