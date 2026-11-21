# B2 — Backpack arrangement

Owner: Lilie · Issue: #2 · Branch: `feat/b2-backpack-arrangement`

## What it does
- You can rearrange the backpack in two clicks: click an item to select it, then click another slot to move it there.
- Moving onto an occupied slot swaps the two items.
- While an item is selected, it's highlighted, and every slot you can move to is marked "Move here" or "⇄ Swap".
- Clicking the selected item again, the "Cancel" button or Esc cancels the selection.

## How it works (code path)
Click on a slot → `Backpack.handleSlotClick(index)`:
- **Nothing selected** and the slot holds an item → `setSelectedUid(item.uid)`. This is local React state only, and the game state doesn't change.
- **The selected slot is clicked again** → `setSelectedUid(null)`, which cancels.
- **Another slot is clicked** and `moveBlocker(run, from, to) === null` → `onMove(from, to)` → `ShopPage.handleMove` → `update(current => updateRun(current, run => moveItem(run, from, to)))` → `moveItem` in `run.ts` swaps the two array entries (`[a[from], a[to]] = [a[to], a[from]]`). If the target is `null`, that's a move; otherwise it's a swap.

**Showing possible moves:** the UI asks `moveBlocker(run, selected, index)` for every slot and highlights those where it returns `null`. That's the same blocker pattern as in B1: the same function decides what is shown and what the rule allows.

**Only while shopping:**
- `updateRun` ignores moves outside the `shop` phase.
- `Backpack` gets `locked={phase !== "shop"}` and ignores any selection while locked.
- The `<fieldset disabled>` disables all buttons.

## Decisions
- **Where does the selection live?**
  - Options: in `GameState` / local component state.
  - → **Local state in `Backpack`.** The selection is pure UI and has no effect on the rules. It doesn't belong in the game state, and B6 doesn't need to save it.
  - Trade-off: it's lost when you leave the page. That doesn't matter, because a new page means a new phase.
- **Store the selection as a slot index or an item uid?** → **The uid.** With an index, selling the selected item and then buying a new one into the same slot would silently select the new item. With the uid, the selection simply disappears once the item is gone.
- **How do you move?**
  - Options: drag and drop / click, then click.
  - → **Two clicks.** It's simpler, works on touch and keyboard without extra code, and the "show possible moves" part is easy to build.
  - Trade-off: it's less "natural" than dragging.
- **Do positions matter in battle?** → **No.** The requirement only asks for arranging, so position stays cosmetic. The rules text now says "doesn't matter in battle".

## Values / rules
- Cancelling: click the item again, the "Cancel" button, or Esc.
- Blocked moves (`moveBlocker`): empty source ("Nothing to move"), target outside the grid, or the same slot.

## Verification
- **Unit tests:** `src/run.test.ts`, block "move" (3 tests):
  - move to an empty slot
  - swap with an occupied slot (no item lost or duplicated)
  - an empty source, the same slot or a target outside the grid change nothing
- **Manual checks:**
  1. Click an item → it's highlighted, and all other slots show "Move here" or "⇄ Swap".
  2. Click an empty slot → the item moves there. Click another item → the two swap.
  3. Select an item, then click it again / click Cancel / press Esc → the selection is gone and nothing moves.
  4. Select an item and sell it → no selection remains. Buy a new item into that slot → it isn't selected.
  5. Select an item and click "Find opponent" → the selection disappears and nothing can be moved while searching.

## Known limitations
- There's no drag and drop.
- After a failed search, an item that was selected before the search is selected again, because the uid is kept in local state. That's harmless, since nothing moves without another click.
