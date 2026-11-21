import { describe, expect, it } from "vitest";
import {
  BURN_DAMAGE_PER_STACK,
  BURN_DECAY,
  BURN_INTERVAL,
  buildFighter,
  buildOpponentFighter,
  POISON_DAMAGE_PER_STACK,
  POISON_INTERVAL,
  simulateBattle,
} from "./battle";
import { activeSets, SETS } from "./sets";
import type { Fighter, ItemEffects } from "./types";

/** A fighter with one item per given [cooldown, effects] pair. */
const fighter = (maxHp: number, ...items: [number, ItemEffects][]): Fighter => ({
  name: "Test",
  maxHp,
  items: items.map(([cooldown, effects], i) => ({ itemId: `item-${i}`, name: `Item ${i}`, icon: "•", cooldown, effects })),
  activeSets: [],
});

/** A fighter that never does anything within a battle (cooldown longer than the battle). */
const dummy = (maxHp: number) => fighter(maxHp, [1000, {}]);

describe("poison", () => {
  it("stacks up and deals damage per stack every POISON_INTERVAL ticks", () => {
    // Adds 1 stack on ticks 1, 2, 3, … → at tick 3 there are 3 stacks, at tick 6 there are 6.
    const result = simulateBattle(fighter(100, [1, { poison: 1 }]), dummy(1000));
    const ticks = result.events.filter((e) => e.kind === "poison-tick");
    expect(ticks[0]).toMatchObject({ tick: POISON_INTERVAL, target: "opponent", amount: POISON_INTERVAL });
    expect(ticks[1]).toMatchObject({ tick: 2 * POISON_INTERVAL, amount: 2 * POISON_INTERVAL });
  });

  it("ignores block", () => {
    // The opponent gains lots of block every tick, but poison still lowers its HP.
    const result = simulateBattle(fighter(100, [1, { poison: 1 }]), fighter(1000, [1, { block: 50 }]));
    const afterFirstTick = result.frames[POISON_INTERVAL].opponent;
    expect(afterFirstTick.block).toBeGreaterThan(0);
    expect(afterFirstTick.hp).toBe(1000 - POISON_INTERVAL);
  });
});

describe("heal", () => {
  it("restores HP but never above max HP", () => {
    // Opponent hits for 5 every 2 ticks; the player heals 3 every tick.
    const result = simulateBattle(fighter(20, [1, { heal: 3 }]), fighter(1000, [2, { damage: 5 }]));
    for (const frame of result.frames) expect(frame.player.hp).toBeLessThanOrEqual(20);
    const heals = result.events.filter((e) => e.kind === "heal" && e.tick === 1);
    expect(heals[0].amount).toBe(0); // already at full HP on tick 1
  });

  it("can't bring a knocked-out fighter back", () => {
    // The player (resolved first) knocks out the 10 HP opponent on tick 1; the opponent's heal fires
    // in the same tick afterwards, but must not revive it.
    const result = simulateBattle(fighter(100, [1, { damage: 10 }]), fighter(10, [1, { heal: 10 }]));
    expect(result.winner).toBe("player");
    expect(result.reason).toBe("knockout");
    expect(result.events.some((e) => e.kind === "heal")).toBe(false);
  });
});

describe("burn", () => {
  it("is absorbed by block first", () => {
    // By tick 2 the opponent has 20 block and 8 burn stacks (16 damage): the burn tick only eats block.
    const result = simulateBattle(fighter(100, [1000, {}], [1, { burn: 4 }]), fighter(1000, [1, { block: 10 }]));
    const tick = result.events.find((e) => e.kind === "burn-tick")!;
    expect(tick.tick).toBe(BURN_INTERVAL);
    expect(result.frames[BURN_INTERVAL].opponent.hp).toBe(1000);
  });

  it("decays until it wears off", () => {
    // The item fires on tick 10 (and 20, …) and adds 4 stacks; burn then ticks on 10, 12, … and decays each time.
    const result = simulateBattle(fighter(100, [10, { burn: 4 }]), dummy(1000));
    const stacks = (tick: number) => result.frames[tick].opponent.burn;
    expect(stacks(10)).toBe(4 - BURN_DECAY);
    expect(stacks(12)).toBe(Math.max(0, 4 - 2 * BURN_DECAY));
    expect(stacks(18)).toBe(0);
    const ticksBetween = result.events.filter((e) => e.kind === "burn-tick" && e.tick > 10 && e.tick < 20);
    expect(ticksBetween.length).toBeLessThan(4); // wore off before the next application
  });

  it("stacks faster, ticks more often and hits harder per stack than poison", () => {
    // Every poison item adds 1 stack per hit; a Fire item adds the Fire bonus.
    expect(SETS.fire.bonus.burn).toBeGreaterThan(1);
    expect(BURN_INTERVAL).toBeLessThan(POISON_INTERVAL);
    expect(BURN_DAMAGE_PER_STACK).toBeGreaterThan(POISON_DAMAGE_PER_STACK);
  });
});

describe("sets", () => {
  it("activate with 2 items and add the bonus to those items only", () => {
    expect(activeSets(["ember-torch"])).toEqual([]);
    const f = buildFighter(["ember-torch", "fire-bomb", "chipped-dagger"], 40);
    expect(f.activeSets).toEqual(["fire"]);
    expect(f.items[0].effects.burn).toBe(SETS.fire.bonus.burn);
    expect(f.items[2].effects.burn).toBeUndefined();
  });

  it("apply to opponents the same way", () => {
    const opponent = buildOpponentFighter({ id: "x", name: "X", icon: "x", hp: 30, round: 1, items: ["viper-fang", "venom-flask"] });
    expect(opponent.activeSets).toEqual(["venom"]);
    expect(opponent.items[0].effects.poison).toBe(1 + SETS.venom.bonus.poison!);
  });
});

it("is deterministic with poison and heal", () => {
  const player = fighter(40, [4, { poison: 1 }], [5, { heal: 3 }]);
  const enemy = fighter(40, [3, { damage: 4 }], [6, { poison: 2 }]);
  expect(simulateBattle(player, enemy)).toEqual(simulateBattle(player, enemy));
});
