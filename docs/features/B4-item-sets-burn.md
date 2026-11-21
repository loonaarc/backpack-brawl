# B4 — Item sets & Burn

Owner: Lilie · Issue: #4 · Branch: `feat/b4-item-sets-burn`

## What it does
- There are two item sets:
  - **🔥 Fire:** Ember Torch, Fire Bomb, Magma Buckler. All three are new.
  - **🐍 Venom:** Viper Fang, Scorpion Stinger, Venom Flask. These are the existing poison items from B3.
- With **2 or more** items of a set in a backpack, the set bonus is active, for the player and for opponents alike:
  - **Fire:** every Fire item additionally adds **+2 Burn**.
  - **Venom:** every Venom item additionally adds **+1 Poison**.
- **Burn** is a new damage-over-time status, and it differs from poison in every way the requirement asks for:

  | | Poison (B3) | Burn (B4) |
  |---|---|---|
  | Stacks per hit | 1 per poison item | 2 per Fire item (set bonus) |
  | Ticks every | 3 ticks (1.5 s) | 2 ticks (1 s) |
  | Damage per stack | 1 | 2 |
  | Block | ignored | absorbs it first |
  | Wears off | never | −2 stacks after each tick |
- **Set badges** appear on items in the shop (`ItemCard`), in the backpack, and next to each item in battle.
- **Active bonuses** are listed under the backpack and on each fighter in battle, e.g. "🔥 Fire 2/2 · bonus active". The list includes sets that aren't active yet, e.g. "1/2", so you can see what you're working towards.

## How it works (code path)
**Data:**
- `ItemDef.set` (`types.ts`) marks which set an item belongs to.
- `src/sets.ts` holds `SETS`, each set's `bonus` (an `ItemEffects` object), and `SET_BONUS_MIN_ITEMS = 2`.
- Helper functions:
  - `setCounts(itemIds)` counts how many items of each set are in a list
  - `activeSets(itemIds)` returns the sets with at least 2 items
  - `withBonus(effects, bonus)` adds the bonus values on top of an item's own effects
  - `describeSetBonus(set)` builds the player-facing text

**Applying the bonus**, once per battle, in `buildFighter` (`battle.ts`):
1. `active = activeSets(itemIds)`
2. For every item: if `def.set` is active, `effects = withBonus(def.effects, SETS[set].bonus)`.
3. The fighter gets `activeSets: active` for display.

`buildPlayerFighter` and `buildOpponentFighter` both go through `buildFighter`, so **bonuses work the same for opponents automatically**. The simulation itself doesn't know about sets at all. It just sees items whose effects now include `burn` or more `poison`.

**Burn in `simulateBattle`:**
1. `resolveItem`: `burn` → `enemy.burn += n`, plus a `burn` event.
2. Every `BURN_INTERVAL` ticks, `applyBurn` runs: `damage = burn * BURN_DAMAGE_PER_STACK`, block absorbs first (just like normal damage), the rest hits HP, then `burn -= BURN_DECAY` (never below 0), plus a `burn-tick` event.
3. Then poison (B3), then the knockout check.

**UI:**
- `components/SetBadge.tsx`:
  - `SetBadge` is the pill shown on items, with a tooltip listing the set's items and bonus (`SET_HELP` in `rules.ts`).
  - `SetSummary` shows the progress and active bonuses for a list of item ids. It's used in `Backpack` and in `BattleView.FighterPanel`.
- `BattleView` shows a "🔥 Burn: n" counter next to poison. Log lines are coloured orange, and a 🔥 icon marks burn ticks.
- `rules.ts` has the `EFFECT_HELP.burn` tooltip and a new "🧩 Sets" section in the rules panel. All texts are built from the constants (`BURN_*`, `SET_BONUS_MIN_ITEMS`, `SETS`).

## Decisions
- **Where is the set bonus applied?** Options: inside the simulation every tick / once when building the fighter. → **Once in `buildFighter`.** The simulation stays simple and only sees effects. Player and opponents are treated the same with no extra code, and the bonus is fixed for the whole battle, which keeps it deterministic. The trade-off: bonuses can only be "extra effects on set items", not, say, "+10 max HP". That's enough for these two sets.
- **What does a bonus look like?** → An `ItemEffects` object that's added on top of every set item's effects. One mechanism covers both sets, and the description text is generated from it.
- **Is Burn an item effect or a set bonus?** → **Only from the Fire set bonus.** The requirement says "the Fire set adds a new status, Burn". Fire items without the bonus just deal damage or block, and the shop cards show the Burn bonus through the set badge's tooltip.
- **Second set:** → **Venom**, reusing the three poison items from B3, which the requirement explicitly allows ("Sets may reuse existing items"). Its bonus strengthens poison, so B3 and B4 fit together.
- **Burn values:** I tested several variants in a throwaway simulation, not committed:
  - The first version (Fire Bomb 6 damage, burn decay 1) made a 4-item Fire build beat almost every opponent.
  - The final values are weaker Fire items (Torch 1 damage, Bomb 4, Buckler only block) and a **decay of 2**.
  - Result: a 4-item Fire build is slightly better than a 4-item damage build and wins 4 of the 7 opponents. It's not dominant.
- **Does burn decay go below 0?** → No, `Math.max(0, …)`.
- **Order inside a tick:** items → burn → poison → knockout check. It's fixed, so the battle stays deterministic.

## Values / rules
| Constant | Value | Where |
|---|---|---|
| `SET_BONUS_MIN_ITEMS` | 2 | `sets.ts` |
| Fire bonus | `{ burn: 2 }` | `sets.ts` |
| Venom bonus | `{ poison: 1 }` | `sets.ts` |
| `BURN_INTERVAL` | 2 ticks (1 s) | `battle.ts` |
| `BURN_DAMAGE_PER_STACK` | 2 | `battle.ts` |
| `BURN_DECAY` | 2 stacks per burn tick | `battle.ts` |

| New item | Price | Cooldown | Effect | Set |
|---|---:|---:|---|---|
| 🕯️ Ember Torch | 3 | 4 | 1 damage | Fire |
| 🧨 Fire Bomb | 5 | 7 | 4 damage | Fire |
| 🌋 Magma Buckler | 4 | 6 | +3 block | Fire |

**Opponents with an active set:**
- Round 5, Pit Gladiator: Ember Torch + Fire Bomb, so Fire is active
- Round 7, Hollow King: Viper Fang + Scorpion Stinger, so Venom is active

## Verification
- **Unit tests:** `src/battle.test.ts`, blocks "burn" and "sets" (5 tests):
  - block absorbs burn first
  - burn decays until it wears off
  - Burn's values stack faster, tick more often and hit harder than poison. This test protects the requirement if someone rebalances later.
  - a set activates at exactly 2 items, and only set items get the bonus
  - opponents get set bonuses the same way
- **Manual checks:**
  1. Shop: Fire and Venom items show a "🔥 Fire" / "🐍 Venom" badge. Hovering it shows the set's items and bonus.
  2. Buy one Fire item → under the backpack, "🔥 Fire 1/2" appears in grey. Buy a second → "🔥 Fire 2/2 · bonus active" appears in gold.
  3. Fight with 2 Fire items → the opponent's "🔥 Burn" counter goes up and back down. The orange log lines show "(n blocked)" when the opponent has block.
  4. Round 5 (Pit Gladiator) → the opponent panel shows "🔥 Fire 2/2 · bonus active", and you get burned.
  5. The rules panel has a "🧩 Sets" section and a Burn line.

## Known limitations
- Each item belongs to at most one set.
- Bonuses only add item effects. There are no other bonus kinds, like extra HP or faster cooldowns.
- Burn and poison don't interact.
