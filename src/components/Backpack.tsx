import { useEffect, useState } from "react";
import { TICK_SECONDS } from "../battle";
import { describeEffects, getItem } from "../items";
import { moveBlocker, sellBlocker, sellPrice } from "../run";
import { SETS } from "../sets";
import { BACKPACK_COLS, itemIdsOf } from "../shop";
import type { ItemDef, RunState } from "../types";
import { SetBadge, SetSummary } from "./SetBadge";

/** Hover text for a backpack slot: name, set, effects and cooldown. */
const tooltip = (item: ItemDef) =>
  [
    item.name,
    ...(item.set ? [`${SETS[item.set].icon} ${SETS[item.set].name} set`] : []),
    ...describeEffects(item.effects).map(({ label }) => label),
    `⏱️ every ${item.cooldown * TICK_SECONDS}s`,
  ].join("\n");

interface BackpackProps {
  run: RunState;
  /** True while the backpack can't be changed (e.g. during a search). */
  locked: boolean;
  onSell: (slot: number) => void;
  onMove: (from: number, to: number) => void;
}

/**
 * The backpack grid. Arranging works in two clicks: click an item to select it, then click another slot
 * to move it there (an occupied slot swaps). Clicking the selected item again, "Cancel" or Esc cancels.
 * The selection is UI-only state; the move itself is the pure `moveItem` rule.
 */
export function Backpack({ run, locked, onSell, onMove }: BackpackProps) {
  // The selection is stored by item uid, not slot index: if the selected item is sold, the selection simply disappears
  // instead of jumping to whatever is bought into that slot next.
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  // A selection only counts while the backpack is editable and the item is still in it.
  const selectedIndex = selectedUid === null ? -1 : run.backpack.findIndex((slot) => slot?.uid === selectedUid);
  const selected = !locked && selectedIndex !== -1 ? selectedIndex : null;

  useEffect(() => {
    if (selected === null) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setSelectedUid(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function handleSlotClick(index: number) {
    if (selected === null) {
      const item = run.backpack[index];
      if (item) setSelectedUid(item.uid);
    } else if (selected === index) {
      setSelectedUid(null);
    } else if (moveBlocker(run, selected, index) === null) {
      onMove(selected, index);
      setSelectedUid(null);
    }
  }

  const selectedItem = selected !== null ? getItem(run.backpack[selected]!.itemId) : null;

  return (
    <section className="rounded-lg border border-panel-edge bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">🎒 Backpack</h2>
        {selectedItem && (
          <button type="button" onClick={() => setSelectedUid(null)} className="rounded bg-panel-edge px-2 py-0.5 text-xs hover:brightness-125">
            Cancel
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {selectedItem
          ? `Moving ${selectedItem.name}: pick a slot (occupied slots swap). Esc cancels.`
          : "Click an item to move it. Hover to see its stats."}
      </p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {run.backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          const isSelected = selected === index;
          const isTarget = selected !== null && moveBlocker(run, selected, index) === null;
          const sellReason = sellBlocker(run, index);

          let hint: string | undefined;
          if (isSelected) hint = "Selected. Click again to cancel";
          else if (isTarget) hint = item ? `Swap with ${item.name}` : "Move here";
          else if (item) hint = tooltip(item);

          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              className={[
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 p-1",
                isSelected
                  ? "border-gold bg-gold/20 ring-2 ring-gold"
                  : isTarget
                    ? "border-dashed border-gold/70"
                    : item
                      ? "border-gold/40 bg-ink/40"
                      : "border-dashed border-panel-edge",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => handleSlotClick(index)}
                disabled={!item && !isTarget}
                title={hint}
                aria-label={item ? item.name : `Empty slot ${index + 1}`}
                aria-pressed={isSelected}
                className="flex w-full flex-1 flex-col items-center justify-center gap-1 disabled:cursor-default"
              >
                {item ? (
                  <>
                    <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="text-center text-xs leading-tight">{item.name}</span>
                    {item.set && <SetBadge set={item.set} compact />}
                  </>
                ) : (
                  isTarget && <span className="text-xs text-gold">Move here</span>
                )}
                {item && isTarget && <span className="text-xs text-gold">⇄ Swap</span>}
              </button>
              {item && (
                <button
                  type="button"
                  onClick={() => onSell(index)}
                  disabled={sellReason !== null}
                  title={sellReason ?? `Sell ${item.name} for ${sellPrice(item.id)} 🪙`}
                  className="rounded bg-panel-edge px-2 py-0.5 text-xs hover:brightness-125 disabled:text-muted"
                >
                  Sell +{sellPrice(item.id)} 🪙
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <SetSummary itemIds={itemIdsOf(run.backpack)} />
      </div>
    </section>
  );
}
