# B3 — Status effects: Poison & Heal

Owner: Lilie · Issue: #3 · Branch: `feat/b3-poison-heal`

## What it does
- **Poison:** items add poison stacks to the enemy. Every 3 ticks (1.5 s) a poisoned fighter loses 1 HP per stack. Poison ignores block, and the stacks stay for the whole battle.
- **Heal:** items restore their owner's HP, never above max HP.
- The catalog has 3 new items per effect, and opponents in rounds 3, 4, 6 and 7 use them.
- Both effects are shown in the battle view (poison counter per fighter), the combat log (purple for poison, green for heal), the item tooltips and the rules panel.

## How it works (code path)
`simulateBattle` in `battle.ts` runs these steps each tick:
1. `chargeItems`: every item charges by one, and items that reach their cooldown fire.
2. `resolveItem` for each fired item, player first, then opponent:
   - `damage` → block absorbs first, the rest hits HP (unchanged from the starter)
   - `block` → adds block (unchanged)
   - **`poison`** → `enemy.poison += n`, plus a `poison` event
   - **`heal`** → `healed = min(heal, maxHp - hp)`, `hp += healed`, plus a `heal` event. Skipped if the fighter is already at 0 HP.
3. **New:** if `tick % POISON_INTERVAL === 0`, `applyPoison` runs for both fighters: `hp -= poison * POISON_DAMAGE_PER_STACK`, straight to HP without touching block, plus a `poison-tick` event.
4. Knockout check (unchanged): if both fighters are down, the player loses.

**Data flow to the UI:**
- `FighterState.poison` is copied into every `FighterSnapshot` (`snapshot()`), so each replay frame knows the stacks.
- `BattleView.FighterPanel` shows `☠️ Poison: n`.
- `LogLine` colours events by `kind`. `poison-tick` events have no `itemId`, because no item fired, so they get the ☠️ icon instead.

**Explanations:**
- `EFFECT_HELP` in `rules.ts` is a `Record<keyof ItemEffects, string>`, so TypeScript forces a tooltip for every new effect.
- The texts are built from `POISON_INTERVAL` and `POISON_DAMAGE_PER_STACK`, so they stay correct if the values change.
- `describeEffects` (`items.ts`) produces the labels `☠️ +n poison` / `💚 +n HP` for shop cards and backpack tooltips.

## Decisions
- **When does poison deal damage?** Options: every tick / at a fixed interval / when the poisoner's item fires. → **A fixed global interval (every 3 ticks), after all items have fired.** It's easy to explain ("every 1.5 s") and fully deterministic. The interval also leaves room for B4's Burn, which has to tick faster and harder.
- **Does poison wear off?** → **No**, stacks last the whole battle. The requirement only says "stacks up". This also makes Burn clearly different, because Burn must decay.
- **Can heal save a fighter who is already at 0 HP in the same tick?** → **No.** Otherwise the order "player first, then opponent" would let the opponent revive after a lethal hit, which feels wrong. Without this rule, "0 HP = knocked out" wouldn't hold.
- **Heal at full HP:** the item still fires and logs "heals for 0 (max HP)". It's transparent in the log and simpler than skipping the event.
- **New items or change existing ones?** → **6 new items.** The existing balance stays the same, and no B1/B2 behaviour changes.
- **Should `itemId` on events be optional?** → **Yes**, because a poison tick isn't caused by an item firing. The alternative was a fake item id, which would be misleading.

## Values / rules
| Constant | Value | Where |
|---|---|---|
| `POISON_INTERVAL` | 3 ticks (1.5 s) | `battle.ts` |
| `POISON_DAMAGE_PER_STACK` | 1 HP | `battle.ts` |

| Item | Price | Cooldown | Effect |
|---|---:|---:|---|
| 🐍 Viper Fang | 3 | 4 | +1 poison |
| 🦂 Scorpion Stinger | 4 | 5 | 2 damage, +1 poison |
| 🧪 Venom Flask | 5 | 8 | +3 poison |
| 🌿 Healing Herb | 2 | 5 | +3 HP |
| 🩹 Field Bandage | 3 | 6 | +2 block, +3 HP |
| 🍖 Hearty Ration | 4 | 8 | +8 HP |

**Opponents** (`server/opponents.js`):
- Round 3: Viper Fang instead of a Chipped Dagger
- Round 4: Healing Herb instead of the Pot Lid
- Round 6: Venom Flask instead of the Chipped Dagger
- Round 7: Hearty Ration instead of the Pot Lid

**Balance check** (a throwaway simulation, not committed): a 4-item poison build and a 4-item heal build win roughly as often as a 4-item damage build against the opponent table. Neither effect is overpowered.

## Verification
- **Unit tests:** `src/battle.test.ts` (5 tests):
  - poison stacks and deals damage per stack every `POISON_INTERVAL` ticks
  - poison ignores block
  - heal never exceeds max HP, and logs 0 at full HP
  - a knocked-out fighter can't heal back. I checked this test **fails** when the guard is removed.
  - the battle stays deterministic with both effects
- **Manual checks:**
  1. Buy a Viper Fang and fight → the opponent's "☠️ Poison" counter goes up, and every 1.5 s a purple "Poison deals n" line appears in the log.
  2. Fight round 3 (Tollgate Ogre has a Viper Fang) → your own poison counter goes up.
  3. Buy a Healing Herb → green heal lines appear, and HP never goes above max.
  4. Hover the poison counter, the ☠️/💚 effect labels on shop cards, and the rules panel → each shows an explanation.

## Known limitations
- Heal isn't shown as a separate counter, only in the log and in the HP bar going up. The requirement only asks for that for poison ("for example a poison counter").
- Block from Field Bandage and poison are independent. There's no cleanse effect.
