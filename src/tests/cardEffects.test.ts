import { describe, expect, it } from 'vitest';
import { trainingEnemies } from '../game/data/enemies/training';
import { playCard, startCombat, startRun } from '../game/engine/combat';

function forceHand(combat: ReturnType<typeof startCombat>['combat'], definitionIds: string[]) {
  return {
    ...combat,
    hand: definitionIds.map((definitionId, index) => ({
      definitionId,
      instanceId: `forced-${definitionId}-${index}`,
    })),
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
  };
}

describe('card effects', () => {
  it('短刃推进 deals 6 damage', () => {
    const run = startRun('short-blade');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['short-blade-advance']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].hp).toBe(22);
  });

  it('架势防护 grants 5 block', () => {
    const run = startRun('guarded-stance');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['guarded-stance']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.player.block).toBe(5);
    expect(combat.energy).toBe(2);
  });

  it('破势重击 deals damage and makes later attacks benefit from vulnerable', () => {
    const run = startRun('break-stance');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['break-stance-smash', 'short-blade-advance']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].hp).toBe(11);
    expect(combat.enemies[0].statuses.vulnerable).toBe(2);
    expect(combat.energy).toBe(0);
  });

  it('热血 exhausts itself and increases future damage', () => {
    const run = startRun('hot-blood');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['hot-blood', 'short-blade-advance']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.player.statuses.strength).toBe(2);
    expect(combat.exhaustPile).toHaveLength(1);
    expect(combat.enemies[0].hp).toBe(20);
  });
});
