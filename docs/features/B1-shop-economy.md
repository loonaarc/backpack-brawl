# B1 — Shop economy

Owner: Lilie · Issue: #1 · Branch: `feat/b1-shop-economy`

## What it does
- You can sell any backpack item for half its price, rounded down.
- You can reroll all four shop offers for 1 🪙.
- Buying into a full backpack is no longer possible. In the starter it took the gold and lost the item.

## How it works (code path)
All three actions work the same way as the existing buy action:

| Action | UI | Handler (`ShopPage.tsx`) | Rule (`run.ts`) |
|---|---|---|---|
| Buy | button in `Shop.tsx` | `handleBuy` | `buyBlocker` → `buyItem` |
| Sell | "Sell +X 🪙" button per item in `Backpack.tsx` | `handleSell` | `sellBlocker` → `sellItem` (refund = `sellPrice`) |
| Reroll | "🎲 Reroll" button in the `Shop.tsx` header | `handleReroll` | `rerollBlocker` → `rerollShop` |

Every handler calls `update(current => updateRun(current, action))`.

1. **`updateRun`** (`game.ts`) only runs the action while `phase === "shop"`. This is the "only while shopping" rule. In the UI, the `<fieldset disabled>` in `ShopPage` greys out all buttons while searching.
2. **Blocker pattern:** each action has a `…Blocker(state, …)` function that returns a reason (string) or `null`.
   - The **UI** uses it to disable the button and show the reason as label or tooltip, so you know why before trying.
   - The **action** calls the same function first and returns the **unchanged state object** if it's blocked.

   So the interface and the rule can never disagree.
3. **All or nothing:** each action builds one new `RunState`, with gold and backpack/shop changed together. There's no state in between where gold is paid but the item is missing. If the action is blocked, the same object is returned, and `updateRun` sees `run === game.run` and changes nothing.

## Decisions
- **Does a sold item's shop offer come back?** Options: the offer reappears / it stays sold. → **It stays sold.** Otherwise buying and selling could loop, and it's unclear where the offer would go if the shop had no free place. Trade-off: a mis-buy can only be undone by selling at a loss.
- **Which offers does a reroll replace?** Options: only the unsold ones / all four. → **All four**, including sold ones. It's simpler, and you get a full fresh shop for your gold.
- **Where does a reroll's randomness come from?** → From the run's seeded RNG (`rollShop(run.seed)`), and the new seed is stored. The same run always rerolls to the same offers. That keeps shops deterministic, and B6 can rely on it: a refresh can't produce a free different shop.
- **How do you sell?** Options: click the item / a separate button. → **A button**, because in B2 clicking an item will mean "select".
- **Order of buy blockers:** "Already sold" → "Backpack is full" → "Not enough gold". The most permanent reason is shown first.

## Values / rules
- Sell refund: `Math.floor(price / 2)`. Chipped Dagger and Pot Lid → 1, Oak Buckler → 1, Hunting Bow and Spiked Shield → 2, Iron Cleaver → 2.
- Reroll cost: `REROLL_COST = 1` (`run.ts`). It's shown in the button and in the rules panel, which reads it from the constant.

## Verification
- **Unit tests:** `src/run.test.ts` (6 tests):
  - buying into a full backpack leaves the state unchanged
  - sell refunds half (rounded down) and frees the slot
  - the offer stays sold after selling
  - selling an empty slot does nothing
  - reroll costs 1, fills all offers and is deterministic
  - reroll at 0 gold does nothing, so gold never becomes negative
- **Manual checks:**
  1. Fill all 6 slots → the remaining offers show "Backpack is full", and gold is unchanged.
  2. Sell an item → gold + half the price, the slot is empty, the shop offer is still "Sold".
  3. Reroll → gold − 1, four new offers. Spend down to 0 gold → the reroll button shows "Not enough gold" and is disabled.
  4. Click "Find opponent" → all shop and backpack buttons are disabled while searching.
- CI runs lint, tests and build on every push.

## Known limitations
- There's no confirmation before selling. One click sells the item.
- `sellBlocker` has only one reason (empty slot). Phase checks are handled centrally by `updateRun`, not repeated in each blocker.
