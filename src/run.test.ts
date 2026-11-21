import { describe, expect, it } from "vitest";
import { buyItem, newRun, REROLL_COST, rerollShop, sellItem } from "./run";
import type { RunState } from "./types";

/** A run with a known shop: every offer is a Chipped Dagger (price 2). */
const runWithDaggers = (overrides: Partial<RunState> = {}): RunState => ({
  ...newRun(42),
  shop: ["chipped-dagger", "chipped-dagger", "chipped-dagger", "chipped-dagger"],
  ...overrides,
});

const fullBackpack = Array.from({ length: 6 }, (_, i) => ({ uid: `item-${i}`, itemId: "pot-lid" }));

describe("buy", () => {
  it("does nothing when the backpack is full, so no gold is lost", () => {
    const run = runWithDaggers({ backpack: fullBackpack });
    expect(buyItem(run, 0)).toBe(run);
  });
});

describe("sell", () => {
  it("refunds half the price rounded down and frees the slot", () => {
    const bought = buyItem(runWithDaggers({ shop: ["iron-cleaver", null, null, null] }), 0); // price 5
    const sold = sellItem(bought, 0);
    expect(sold.gold).toBe(bought.gold + 2);
    expect(sold.backpack[0]).toBeNull();
  });

  it("keeps the shop offer sold", () => {
    const bought = buyItem(runWithDaggers(), 0);
    expect(sellItem(bought, 0).shop[0]).toBeNull();
  });

  it("does nothing for an empty slot", () => {
    const run = runWithDaggers();
    expect(sellItem(run, 0)).toBe(run);
  });
});

describe("reroll", () => {
  it("costs gold, replaces the offers and advances the seed deterministically", () => {
    const run = runWithDaggers({ shop: [null, null, null, null] });
    const rerolled = rerollShop(run);
    expect(rerolled.gold).toBe(run.gold - REROLL_COST);
    expect(rerolled.shop.every((offer) => offer !== null)).toBe(true);
    expect(rerolled.seed).not.toBe(run.seed);
    expect(rerollShop(run)).toEqual(rerolled);
  });

  it("does nothing without enough gold, so gold never becomes negative", () => {
    const run = runWithDaggers({ gold: 0 });
    expect(rerollShop(run)).toBe(run);
  });
});
