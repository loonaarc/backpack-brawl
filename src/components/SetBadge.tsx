import { SET_HELP } from "../rules";
import { SET_BONUS_MIN_ITEMS, SETS, setCounts } from "../sets";
import type { SetId } from "../types";

/** Small "🔥 Fire" pill for an item's set; hover shows the set's items and bonus. */
export function SetBadge({ set, compact = false }: { set: SetId; compact?: boolean }) {
  const { icon, name } = SETS[set];
  return (
    <span title={SET_HELP[set]} aria-label={`${name} set`} className="cursor-help rounded-full bg-ink/70 px-1.5 text-xs leading-5">
      {compact ? icon : `${icon} ${name}`}
    </span>
  );
}

/**
 * Set progress for a list of item ids: every set with at least one item, e.g. "🔥 Fire 2/2 · active".
 * Shown under the backpack and on each fighter in battle, so active bonuses are always visible.
 */
export function SetSummary({ itemIds }: { itemIds: string[] }) {
  const counts = setCounts(itemIds);
  const present = (Object.keys(SETS) as SetId[]).filter((set) => counts[set] > 0);
  if (present.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Set bonuses">
      {present.map((set) => {
        const active = counts[set] >= SET_BONUS_MIN_ITEMS;
        return (
          <li
            key={set}
            title={SET_HELP[set]}
            className={`cursor-help rounded-md border px-2 py-0.5 ${active ? "border-gold bg-gold/15 font-bold text-gold" : "border-panel-edge text-muted"}`}
          >
            {SETS[set].icon} {SETS[set].name} {counts[set]}/{SET_BONUS_MIN_ITEMS} {active ? "· bonus active" : ""}
          </li>
        );
      })}
    </ul>
  );
}
