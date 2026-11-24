import { describe, expect, it } from "vitest";
import { isReplayDone, newGame, routeForGame, skipReplay, startBattle, startSearch } from "./game";
import { applyBattleResult, buyItem, moveItem, rerollShop } from "./run";
import { restoreGame } from "./save";
import type { Opponent, RunState } from "./types";

const runId = "00000000000000000000000000000001";
const opponent: Opponent = {
  id: "mossback-hermit",
  name: "Mossback Hermit",
  icon: "🐢",
  hp: 25,
  round: 1,
  items: ["chipped-dagger", "pot-lid"],
};

const save = (run: RunState, phase = "shop", opponent?: Opponent) =>
  JSON.stringify({ version: 1, phase, run, opponent });

describe("save and resume", () => {
  it("restores the exact shop, backpack and next reroll", () => {
    const initial = newGame(42, runId).run;
    const run = moveItem(buyItem(rerollShop(initial), 0), 0, 5);
    const restored = restoreGame(save(run));

    expect(restored?.phase).toBe("shop");
    expect(restored?.run).toEqual(run);
    expect(rerollShop(restored!.run)).toEqual(rerollShop(run));
  });

  it("falls back for malformed, incompatible and impossible saves", () => {
    const { run } = newGame(42, runId);
    const bought = buyItem(run, 0);
    const duplicateItem = [bought.backpack[0], bought.backpack[0], null, null, null, null];

    expect(restoreGame("{")).toBeNull();
    expect(restoreGame(JSON.stringify({ version: 2, phase: "shop", run }))).toBeNull();
    expect(restoreGame(save(run, "finished"))).toBeNull();
    expect(restoreGame(save({ ...run, round: 2 }))).toBeNull();
    expect(restoreGame(save({ ...run, gold: -1 }))).toBeNull();
    expect(restoreGame(save({ ...bought, gold: run.gold }))).toBeNull();
    expect(restoreGame(save({ ...bought, backpack: duplicateItem }))).toBeNull();
    expect(restoreGame(save({ ...run, shop: ["unknown", ...run.shop.slice(1)] }))).toBeNull();
    expect(restoreGame(save(bought, "battle", { ...opponent, round: 2 }))).toBeNull();
  });

  it("restores a losing replay's final frame without losing another life on repeat", () => {
    const game = newGame(42, runId);
    const shop = { ...game, run: buyItem(game.run, 0) };
    const battle = startBattle(startSearch(shop, 1), 1, opponent);
    const checkpoint = save(shop.run, "battle", opponent);
    const restored = restoreGame(checkpoint)!;

    expect(routeForGame(restored)).toBe("/battle");
    expect(isReplayDone(restored.battle!)).toBe(true);
    expect(restored.battle?.opponent).toEqual(opponent);
    expect(restored.run).toEqual(skipReplay(battle).run);
    expect(restored.run).toMatchObject({ round: 2, lives: 2, wins: 0, runId });
    expect(skipReplay(restored)).toBe(restored);
    expect(restoreGame(checkpoint)).toEqual(restored);
  });

  it("restores the finished result and keeps its run ID", () => {
    let run = buyItem(newGame(42, runId).run, 0);
    for (let loss = 0; loss < 3; loss += 1) run = applyBattleResult(run, "opponent");
    const restored = restoreGame(save(run, "finished"));

    expect(routeForGame(restored)).toBe("/result");
    expect(restored?.run).toEqual(run);
    expect(restored?.run.runId).toBe(runId);
  });
});
