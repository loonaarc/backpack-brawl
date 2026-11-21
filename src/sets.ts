import { CATALOG, describeEffects, getItem } from "./items";
import type { ItemEffects, SetId } from "./types";

/** A set's bonus is active while a backpack holds at least this many of its items. */
export const SET_BONUS_MIN_ITEMS = 2;

export interface SetDef {
  id: SetId;
  name: string;
  icon: string;
  /** Extra effects every item of the set gets while the bonus is active. */
  bonus: ItemEffects;
}

export const SETS: Record<SetId, SetDef> = {
  fire: { id: "fire", name: "Fire", icon: "🔥", bonus: { burn: 2 } },
  venom: { id: "venom", name: "Venom", icon: "🐍", bonus: { poison: 1 } },
};

/** Catalog items that belong to a set. */
export const setItems = (set: SetId) => CATALOG.filter((item) => item.set === set);

/** How many items of each set are in the given list of item ids (duplicates count). */
export function setCounts(itemIds: string[]): Record<SetId, number> {
  const counts: Record<SetId, number> = { fire: 0, venom: 0 };
  for (const id of itemIds) {
    const set = getItem(id).set;
    if (set) counts[set] += 1;
  }
  return counts;
}

/** Sets whose bonus is active for the given item ids, in `SETS` order. */
export function activeSets(itemIds: string[]): SetId[] {
  const counts = setCounts(itemIds);
  return (Object.keys(SETS) as SetId[]).filter((set) => counts[set] >= SET_BONUS_MIN_ITEMS);
}

/** Adds the set bonus on top of an item's own effects (values of the same effect add up). */
export function withBonus(effects: ItemEffects, bonus: ItemEffects): ItemEffects {
  const result: ItemEffects = { ...effects };
  for (const [effect, value] of Object.entries(bonus) as [keyof ItemEffects, number][]) {
    result[effect] = (result[effect] ?? 0) + value;
  }
  return result;
}

/** Player-facing description of a set bonus, e.g. "With 2+ Fire items: every Fire item also adds 🔥 +2 burn". */
export function describeSetBonus(set: SetId): string {
  const { name, bonus } = SETS[set];
  const labels = describeEffects(bonus).map(({ label }) => label).join(", ");
  return `With ${SET_BONUS_MIN_ITEMS}+ ${name} items: every ${name} item also adds ${labels}.`;
}
