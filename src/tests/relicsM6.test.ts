import { describe, expect, it } from 'vitest';
import { playCard, startCombat, startRun } from '../game/engine/combat';
import { drawCards } from '../game/engine/deck';
import { resolveRelicTriggers } from '../game/engine/relics';
import type { CombatState, EnemyDefinition } from '../game/types';

const waitingEnemy: EnemyDefinition = {
  id: 'm6-relic-waiting-target',
  name: '静置靶',
  lowProfileName: '静置事项',
  maxHp: 12,
  intentPattern: ['wait'],
  moves: [
    {
      id: 'wait',
      name: '静置',
      intent: { type: 'wait', label: '等待' },
      effects: [],
    },
  ],
};

describe('milestone 6 relic triggers', () => {
  it('triggers combat start relics', () => {
    const run = startRun('m6-red-needle', ['red-needle']);
    const { combat } = startCombat(run, waitingEnemy);

    expect(combat.player.statuses.strength).toBe(2);
    expect(combat.player.statuses.dexterity).toBe(1);
  });

  it('triggers turn start relics', () => {
    const run = startRun('m6-quiet-ledger', ['quiet-ledger']);
    const { combat } = startCombat(run, waitingEnemy);

    expect(combat.hand).toHaveLength(6);
    expect(combat.energy).toBe(4);
  });

  it('triggers shuffle relics', () => {
    const run = startRun('m6-anchor-prism', ['anchor-prism']);
    let { combat } = startCombat(run, waitingEnemy);
    combat = {
      ...combat,
      hand: [],
      drawPile: [],
      discardPile: [
        { definitionId: 'hinge-jab', instanceId: 'discard-a' },
        { definitionId: 'shield-press', instanceId: 'discard-b' },
        { definitionId: 'settle-breath', instanceId: 'discard-c' },
      ],
    };

    combat = drawCards(combat, 1, {
      onShuffle: (nextCombat) => resolveRelicTriggers(nextCombat, 'onShuffle'),
    });

    expect(combat.hand.length).toBeGreaterThanOrEqual(2);
  });

  it('triggers victory relic healing', () => {
    const run = startRun('m6-last-bell', ['last-bell']);
    let { combat } = startCombat(run, { ...waitingEnemy, maxHp: 6 });
    combat = forceHand(combat, ['short-blade-advance']);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        hp: 50,
      },
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.phase).toBe('won');
    expect(combat.player.hp).toBe(58);
  });

  it('triggers enemy kill relics', () => {
    const run = startRun('m6-hinge-pin', ['hinge-pin']);
    let { combat } = startCombat(run, { ...waitingEnemy, maxHp: 3 });
    combat = forceHand(combat, ['hinge-jab']);
    combat = {
      ...combat,
      energy: 0,
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.energy).toBe(1);
  });

  it('triggers first skill each turn relics', () => {
    const run = startRun('m6-blueprint-weight', ['blueprint-weight']);
    let { combat } = startCombat(run, waitingEnemy);
    combat = forceHand(combat, ['guarded-stance']);
    combat = {
      ...combat,
      drawPile: [{ definitionId: 'hinge-jab', instanceId: 'skill-draw' }],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.hand.map((card) => card.definitionId)).toContain('hinge-jab');
  });
});

function forceHand(combat: CombatState, definitionIds: string[]): CombatState {
  return {
    ...combat,
    hand: definitionIds.map((definitionId, index) => ({
      definitionId,
      instanceId: `forced-${definitionId}-${index}`,
    })),
    drawPile: [],
    discardPile: [],
    exhaustPile: [],
    energy: 10,
  };
}
