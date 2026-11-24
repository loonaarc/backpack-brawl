import { describe, expect, it } from "vitest";
import { fightBlocker, leaveBattle, newGame, searchFailed, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { buyItem } from "./run";
import type { Opponent } from "./types";

const opponent: Opponent = {
  id: "mossback-hermit",
  name: "Mossback Hermit",
  icon: "🐢",
  hp: 25,
  round: 1,
  items: ["chipped-dagger", "pot-lid"],
};

const runId = "00000000000000000000000000000001";
const readyShop = () => updateRun(newGame(42, runId), (run) => buyItem(run, 0));

describe("opponent search", () => {
  it("blocks an empty backpack and a second search", () => {
    const emptyShop = newGame(42, runId);
    expect(startSearch(emptyShop, 1)).toBe(emptyShop);

    const searching = startSearch(readyShop(), 2);
    expect(searching.search).toEqual({ id: 2, round: 1 });
    expect(fightBlocker(searching)).not.toBeNull();
    expect(startSearch(searching, 3)).toBe(searching);
  });

  it("reopens the unchanged shop on failure and ignores replies from the failed attempt", () => {
    const shop = readyShop();
    const searching = startSearch(shop, 1);
    const failed = searchFailed(searching, 1, "Arena offline");
    expect(failed).toMatchObject({ phase: "shop", search: null, error: "Arena offline" });
    expect(failed.run).toBe(shop.run);
    expect(fightBlocker(failed)).toBeNull();

    const retry = startSearch(failed, 2);
    expect(retry.error).toBeNull();
    expect(startBattle(retry, 1, opponent)).toBe(retry);
    expect(searchFailed(retry, 1, "Late failure")).toBe(retry);
    expect(startBattle(retry, 2, opponent).phase).toBe("battle");
  });

  it("reopens the shop when the current request returns the wrong round", () => {
    const shop = readyShop();
    const searching = startSearch(shop, 1);
    const failed = startBattle(searching, 1, { ...opponent, round: 2 });

    expect(failed).toMatchObject({ phase: "shop", search: null, battle: null });
    expect(failed.error).toBeTruthy();
    expect(failed.run).toBe(shop.run);
  });

  it("ignores duplicate and late replies so a battle is only scored once", () => {
    const searching = startSearch(readyShop(), 1);
    const battle = startBattle(searching, 1, opponent);
    expect(battle).toMatchObject({ phase: "battle", search: null });
    expect(startBattle(battle, 1, opponent)).toBe(battle);

    const settled = skipReplay(battle);
    expect(settled.run.round).toBe(2);
    expect(skipReplay(startBattle(settled, 1, opponent))).toBe(settled);

    const nextShop = leaveBattle(settled);
    expect(startBattle(nextShop, 1, opponent)).toBe(nextShop);
  });
});
