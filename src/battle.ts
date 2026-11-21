import { getItem } from "./items";
import { activeSets, SETS, withBonus } from "./sets";
import { itemIdsOf } from "./shop";
import type { Backpack, BattleEvent, BattleResult, Fighter, FighterItem, FighterSnapshot, Opponent, Side } from "./types";

/** Seconds per battle tick. */
export const TICK_SECONDS = 0.5;
/** Battles that last longer are decided by the timeout rule. */
export const MAX_TICKS = 60;
export const HERO_BASE_HP = 40;
/** Poison deals its damage every this many ticks. */
export const POISON_INTERVAL = 3;
/** HP lost per poison stack each time poison deals damage. */
export const POISON_DAMAGE_PER_STACK = 1;
/** Burn deals its damage every this many ticks (faster than poison). */
export const BURN_INTERVAL = 2;
/** Damage per burn stack each time burn deals damage (more than poison); block absorbs it first. */
export const BURN_DAMAGE_PER_STACK = 2;
/** Burn stacks lost after each time burn deals damage, until it wears off. */
export const BURN_DECAY = 2;

/**
 * Turns a list of item ids into a fighter with the catalog values of each item.
 * Set bonuses are decided here, once per battle: items of an active set get the set's bonus effects
 * added on top. This works the same for the player and for opponents.
 */
export function buildFighter(itemIds: string[], baseHp: number, name = "Fighter"): Fighter {
  const active = activeSets(itemIds);
  const items: FighterItem[] = itemIds.map((id) => {
    const def = getItem(id);
    const bonus = def.set && active.includes(def.set) ? SETS[def.set].bonus : {};
    return { itemId: def.id, name: def.name, icon: def.icon, cooldown: def.cooldown, effects: withBonus(def.effects, bonus), set: def.set };
  });
  return { name, maxHp: baseHp, items, activeSets: active };
}

/** The player's fighter: every backpack item and the hero's base HP. */
export function buildPlayerFighter(backpack: Backpack): Fighter {
  return buildFighter(itemIdsOf(backpack), HERO_BASE_HP, "Hero");
}

export function buildOpponentFighter(opponent: Opponent): Fighter {
  return buildFighter(opponent.items, opponent.hp, opponent.name);
}

interface FighterState {
  fighter: Fighter;
  hp: number;
  block: number;
  poison: number;
  burn: number;
  /** Ticks each item has charged towards its cooldown. */
  charge: number[];
}

const other = (side: Side): Side => (side === "player" ? "opponent" : "player");

const snapshot = (s: FighterState): FighterSnapshot => ({
  hp: Math.max(0, s.hp),
  maxHp: s.fighter.maxHp,
  block: s.block,
  poison: s.poison,
  burn: s.burn,
});

const isDown = (s: FighterState) => s.hp <= 0;

/**
 * Runs a full battle. Pure and deterministic: the same fighters always give
 * the same result.
 *
 * Each tick:
 * 1. Each fighter charges all items by one tick; items whose charge reaches their cooldown fire.
 * 2. Fired items resolve (player first, then opponent). Both sides fire "simultaneously":
 *    which items fire is decided before any effect is applied.
 * 3. Every `BURN_INTERVAL` ticks, each burning fighter takes `BURN_DAMAGE_PER_STACK` per stack (block absorbs it first),
 *    then loses `BURN_DECAY` stacks.
 * 4. Every `POISON_INTERVAL` ticks, each poisoned fighter loses `POISON_DAMAGE_PER_STACK` HP per stack, ignoring block.
 * After step 4 the battle ends if someone is down; if both are down, the player loses.
 * After `MAX_TICKS` the higher HP percentage wins; a tie is a player loss.
 */
export function simulateBattle(player: Fighter, opponent: Fighter): BattleResult {
  const state: Record<Side, FighterState> = {
    player: initState(player),
    opponent: initState(opponent),
  };
  const frames: BattleResult["frames"] = [
    { tick: 0, player: snapshot(state.player), opponent: snapshot(state.opponent), events: [] },
  ];
  const events: BattleEvent[] = [];

  const knockoutWinner = (): Side | null => {
    if (isDown(state.player)) return "opponent";
    if (isDown(state.opponent)) return "player";
    return null;
  };

  let winner: Side | null = null;
  let tick = 0;
  while (winner === null && tick < MAX_TICKS) {
    tick += 1;
    const tickEvents: BattleEvent[] = [];
    const emit = (event: Omit<BattleEvent, "tick">) => tickEvents.push({ tick, ...event });

    const fired: Record<Side, FighterItem[]> = {
      player: chargeItems(state.player),
      opponent: chargeItems(state.opponent),
    };
    for (const side of ["player", "opponent"] as const) {
      for (const item of fired[side]) resolveItem(item, state[side], state[other(side)], side, emit);
    }
    if (tick % BURN_INTERVAL === 0) {
      for (const side of ["player", "opponent"] as const) applyBurn(state[side], side, emit);
    }
    if (tick % POISON_INTERVAL === 0) {
      for (const side of ["player", "opponent"] as const) applyPoison(state[side], side, emit);
    }
    winner = knockoutWinner();

    frames.push({ tick, player: snapshot(state.player), opponent: snapshot(state.opponent), events: tickEvents });
    events.push(...tickEvents);
  }

  if (winner !== null) return { winner, reason: "knockout", frames, events };
  return { winner: timeoutWinner(state.player, state.opponent), reason: "timeout", frames, events };
}

function initState(fighter: Fighter): FighterState {
  return { fighter, hp: fighter.maxHp, block: 0, poison: 0, burn: 0, charge: fighter.items.map(() => 0) };
}

/** Advances one tick of cooldowns and returns the items that fire this tick. */
function chargeItems(s: FighterState): FighterItem[] {
  const fired: FighterItem[] = [];
  s.fighter.items.forEach((item, i) => {
    s.charge[i] += 1;
    if (s.charge[i] >= item.cooldown) {
      s.charge[i] = 0;
      fired.push(item);
    }
  });
  return fired;
}

function resolveItem(
  item: FighterItem,
  self: FighterState,
  enemy: FighterState,
  side: Side,
  emit: (event: Omit<BattleEvent, "tick">) => void,
) {
  const { damage, block, poison, heal, burn } = item.effects;
  const base = { source: side, itemId: item.itemId };
  const enemySide = other(side);

  if (damage) {
    const absorbed = Math.min(enemy.block, damage);
    enemy.block -= absorbed;
    enemy.hp -= damage - absorbed;
    const note = absorbed > 0 ? ` (${absorbed} blocked)` : "";
    emit({ ...base, target: enemySide, kind: "damage", amount: damage, message: `${item.name} hits ${enemy.fighter.name} for ${damage}${note}` });
  }
  if (block) {
    self.block += block;
    emit({ ...base, target: side, kind: "block", amount: block, message: `${item.name} grants ${self.fighter.name} ${block} block` });
  }
  if (burn) {
    enemy.burn += burn;
    emit({ ...base, target: enemySide, kind: "burn", amount: burn, message: `${item.name} sets ${enemy.fighter.name} on fire (+${burn}, now ${enemy.burn})` });
  }
  if (poison) {
    enemy.poison += poison;
    emit({ ...base, target: enemySide, kind: "poison", amount: poison, message: `${item.name} poisons ${enemy.fighter.name} (+${poison}, now ${enemy.poison})` });
  }
  // A knocked-out fighter can't heal back up, even if their item fires in the same tick.
  if (heal && !isDown(self)) {
    const healed = Math.min(heal, self.fighter.maxHp - self.hp);
    self.hp += healed;
    const note = healed < heal ? " (max HP)" : "";
    emit({ ...base, target: side, kind: "heal", amount: healed, message: `${item.name} heals ${self.fighter.name} for ${healed}${note}` });
  }
}

/** Burn damage for one fighter: `BURN_DAMAGE_PER_STACK` per stack, block absorbs it first; then the stacks decay. */
function applyBurn(s: FighterState, side: Side, emit: (event: Omit<BattleEvent, "tick">) => void) {
  if (s.burn === 0) return;
  const damage = s.burn * BURN_DAMAGE_PER_STACK;
  const absorbed = Math.min(s.block, damage);
  s.block -= absorbed;
  s.hp -= damage - absorbed;
  s.burn = Math.max(0, s.burn - BURN_DECAY);
  const note = absorbed > 0 ? ` (${absorbed} blocked)` : "";
  emit({ source: other(side), target: side, kind: "burn-tick", amount: damage, message: `Burn deals ${damage} to ${s.fighter.name}${note}, ${s.burn} left` });
}

/** Poison damage for one fighter: `POISON_DAMAGE_PER_STACK` per stack, straight to HP (block doesn't absorb it). */
function applyPoison(s: FighterState, side: Side, emit: (event: Omit<BattleEvent, "tick">) => void) {
  if (s.poison === 0) return;
  const damage = s.poison * POISON_DAMAGE_PER_STACK;
  s.hp -= damage;
  emit({ source: other(side), target: side, kind: "poison-tick", amount: damage, message: `Poison deals ${damage} to ${s.fighter.name}` });
}

function timeoutWinner(player: FighterState, opponent: FighterState): Side {
  const ratio = (s: FighterState) => s.hp / s.fighter.maxHp;
  return ratio(player) > ratio(opponent) ? "player" : "opponent";
}
