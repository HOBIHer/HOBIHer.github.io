import { describe, expect, it } from 'vitest';
import { trainingEnemies } from '../game/data/enemies/training';
import { playCard, startCombat, startRun } from '../game/engine/combat';
import type { CombatState } from '../game/types';

function forceHand(combat: CombatState, definitionIds: string[]): CombatState {
  return {
    ...combat,
    hand: definitionIds.map((definitionId, index) => ({
      definitionId,
      instanceId: `forced-${definitionId}-${index}`,
    })),
  };
}

describe('relic triggers', () => {
  it('旧铜扣 grants 1 strength on combat start', () => {
    const run = startRun('old-copper-clasp-test', ['old-copper-clasp']);
    const { combat } = startCombat(run, trainingEnemies[0]);

    expect(combat.player.statuses.strength).toBe(1);
  });

  it('裂纹透镜 draws one extra card on the first combat turn', () => {
    const run = startRun('cracked-lens-test', ['cracked-lens']);
    const { combat } = startCombat(run, trainingEnemies[0]);

    expect(combat.hand).toHaveLength(6);
  });

  it('沉纸镇 grants 4 block on combat start', () => {
    const run = startRun('sunken-paperweight-test', ['sunken-paperweight']);
    const { combat } = startCombat(run, trainingEnemies[0]);

    expect(combat.player.block).toBe(4);
  });

  it('余温币 grants 1 energy when the discard pile is shuffled', () => {
    const run = startRun('ember-coin-test', ['ember-coin']);
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['settle-breath']);
    combat = {
      ...combat,
      energy: 1,
      drawPile: [],
      discardPile: [{ definitionId: 'short-blade-advance', instanceId: 'discarded-attack' }],
      exhaustPile: [],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.energy).toBe(1);
    expect(combat.hand.some((card) => card.instanceId === 'discarded-attack')).toBe(true);
  });

  it('静手套 grants 3 block on the first skill played each turn', () => {
    const run = startRun('quiet-glove-test', ['quiet-glove']);
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['guarded-stance', 'guarded-stance']);
    combat = {
      ...combat,
      energy: 3,
      drawPile: [],
      discardPile: [],
      exhaustPile: [],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.player.block).toBe(13);
  });
});
