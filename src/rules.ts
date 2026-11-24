import {
  BURN_DAMAGE_PER_STACK,
  BURN_DECAY,
  BURN_INTERVAL,
  HERO_BASE_HP,
  MAX_TICKS,
  POISON_DAMAGE_PER_STACK,
  POISON_INTERVAL,
  TICK_SECONDS,
} from "./battle";
import { describeSetBonus, SET_BONUS_MIN_ITEMS, SETS, setItems } from "./sets";
import { GOLD_PER_ROUND, REROLL_COST, START_GOLD, START_LIVES, WINS_TO_VICTORY } from "./run";
import { BACKPACK_COLS, BACKPACK_ROWS, SHOP_SIZE } from "./shop";
import type { ItemEffects } from "./types";

/**
 * Player-facing explanations of the rules. Built from the game constants so
 * the texts stay correct when numbers are rebalanced.
 */

const BATTLE_SECONDS = MAX_TICKS * TICK_SECONDS;
const POISON_SECONDS = POISON_INTERVAL * TICK_SECONDS;
const BURN_SECONDS = BURN_INTERVAL * TICK_SECONDS;

/** Tooltip per item effect. */
export const EFFECT_HELP: Record<keyof ItemEffects, string> = {
  damage: "Damage: hits the enemy. Block absorbs it first, the rest is lost from HP.",
  block: "Block: absorbs incoming damage until used up. Unused block stays for the rest of the battle.",
  poison: `Poison: adds stacks to the enemy. Every ${POISON_SECONDS} s a poisoned fighter loses ${POISON_DAMAGE_PER_STACK} HP per stack. Stacks add up, last the whole battle and ignore block.`,
  heal: "Heal: restores the owner's HP, but never above max HP. A knocked-out fighter can't heal.",
  burn: `Burn: adds stacks to the enemy. Every ${BURN_SECONDS} s a burning fighter takes ${BURN_DAMAGE_PER_STACK} damage per stack — block absorbs it first — and then loses ${BURN_DECAY} stacks, until it wears off.`,
};

/** Tooltip per set: its items and bonus. */
export const SET_HELP = Object.fromEntries(
  Object.values(SETS).map((set) => [
    set.id,
    `${set.icon} ${set.name} set (${setItems(set.id).map((item) => item.name).join(", ")}). ${describeSetBonus(set.id)}`,
  ]),
) as Record<keyof typeof SETS, string>;

export const COOLDOWN_HELP = `Cooldown: the item fires every time this much battle time has passed (1 tick = ${TICK_SECONDS} s).`;

export const REFRESH_HELP = {
  search: "Refreshing during a search returns you to the same shop.",
  battle: "Refreshing during a battle skips the replay and shows its result.",
};

/** Tooltip per fighter status shown in battle. */
export const STATUS_HELP = {
  hp: "HP: reaching 0 is a knockout.",
  block: EFFECT_HELP.block,
  poison: EFFECT_HELP.poison,
  burn: EFFECT_HELP.burn,
  timer: `After ${BATTLE_SECONDS} s the fighter with the higher share of HP wins; a tie counts as your loss.`,
};

export interface RuleSection {
  title: string;
  rules: string[];
}

export const RULES: RuleSection[] = [
  {
    title: "🏆 The run",
    rules: [
      `Reach ${WINS_TO_VICTORY} wins before you lose all ${START_LIVES} lives.`,
      `Each battle is one round: a win gives +1 win, a loss costs 1 life.`,
      `Opponents get tougher every round.`,
    ],
  },
  {
    title: "🏪 Shop & backpack",
    rules: [
      `You start with ${START_GOLD} 🪙 and earn ${GOLD_PER_ROUND} 🪙 at the start of every new round. Unspent gold carries over.`,
      `The shop offers ${SHOP_SIZE} new items every round. Reroll for ${REROLL_COST} 🪙 to replace all offers with new ones.`,
      `Bought items go to the first free slot of your ${BACKPACK_COLS}×${BACKPACK_ROWS} backpack. You can't buy when it is full.`,
      `Sell an item for half its price (rounded down) to free its slot. Its shop offer stays sold.`,
      `Click an item, then another slot to move it there; moving onto an item swaps the two. Esc or Cancel stops.`,
      `Only items in your backpack fight. Their position doesn't matter in battle.`,
    ],
  },
  {
    title: "⚔️ Battle",
    rules: [
      `Battles run on their own. Your hero has ${HERO_BASE_HP} HP; every item fires whenever its cooldown is up.`,
      `Damage hits block first; only the rest is lost from HP. Unused block stays for the rest of the battle.`,
      `☠️ Poison adds stacks to the enemy. Every ${POISON_SECONDS} s they lose ${POISON_DAMAGE_PER_STACK} HP per stack, ignoring block. Stacks never wear off.`,
      `💚 Heal restores your own HP, but never above max HP.`,
      `🔥 Burn (from the Fire set) stacks faster and hits harder than poison: each Fire item adds ${SETS.fire.bonus.burn} stacks, and every ${BURN_SECONDS} s it deals ${BURN_DAMAGE_PER_STACK} damage per stack. Unlike poison, block absorbs it, and it loses ${BURN_DECAY} stacks each time until it wears off.`,
      `Knock the enemy out to win. ${STATUS_HELP.timer} If both fall at once, you lose.`,
    ],
  },
  {
    title: "🧩 Sets",
    rules: [
      `Some items belong to a set (badge on the item). With ${SET_BONUS_MIN_ITEMS} or more items of a set in a backpack, its bonus is active — for you and for opponents.`,
      ...Object.values(SET_HELP),
    ],
  },
  {
    title: "Save and resume",
    rules: [
      "Your run is saved automatically in this browser.",
      REFRESH_HELP.search,
      REFRESH_HELP.battle,
    ],
  },
];
