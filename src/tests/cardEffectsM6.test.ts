import { describe, expect, it } from 'vitest';
import { playCard, startCombat, startRun, endPlayerTurn } from '../game/engine/combat';
import type { CombatState, EnemyDefinition } from '../game/types';

const waitingEnemy: EnemyDefinition = {
  id: 'm6-waiting-target',
  name: '静置靶',
  lowProfileName: '静置事项',
  maxHp: 50,
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

const smallEnemy: EnemyDefinition = {
  ...waitingEnemy,
  id: 'm6-small-target',
  maxHp: 20,
};

describe('milestone 6 card effects', () => {
  it('resolves damage plus block on ledger-cleave', () => {
    const run = startRun('m6-ledger-cleave');
    let { combat } = startCombat(run, waitingEnemy);
    combat = forceHand(combat, ['ledger-cleave']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].hp).toBe(38);
    expect(combat.player.block).toBe(6);
  });

  it('applies vulnerable and weak from new cards', () => {
    const run = startRun('m6-status-cards');
    let { combat } = startCombat(run, waitingEnemy);
    combat = forceHand(combat, ['marking-cut', 'dulling-hilt']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].statuses.vulnerable).toBe(1);
    expect(combat.enemies[0].statuses.weak).toBe(1);
  });

  it('trades HP for energy and draw, then exhausts itself', () => {
    const run = startRun('m6-price-of-iron');
    let { combat } = startCombat(run, waitingEnemy);
    combat = forceHand(combat, ['price-of-iron']);
    combat = {
      ...combat,
      drawPile: [{ definitionId: 'hinge-jab', instanceId: 'draw-hinge-jab' }],
      energy: 1,
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.player.hp).toBe(69);
    expect(combat.energy).toBe(2);
    expect(combat.hand.map((card) => card.definitionId)).toContain('hinge-jab');
    expect(combat.exhaustPile[0].definitionId).toBe('price-of-iron');
  });

  it('damages all living enemies and ignores defeated enemies', () => {
    const run = startRun('m6-damage-all');
    let { combat } = startCombat(run, [smallEnemy, { ...smallEnemy, id: 'm6-small-target-b' }]);
    combat = forceHand(combat, ['arc-bell-sweep']);
    combat = {
      ...combat,
      enemies: [
        { ...combat.enemies[0], hp: 0 },
        { ...combat.enemies[1], hp: 20 },
      ],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[1].instanceId);

    expect(combat.enemies[0].hp).toBe(0);
    expect(combat.enemies[1].hp).toBe(10);
  });

  it('resolves conditional card effects', () => {
    const run = startRun('m6-conditional');
    let { combat } = startCombat(run, waitingEnemy);
    combat = forceHand(combat, ['braced-followthrough', 'rivet-drive', 'final-formula']);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        block: 4,
        hp: 30,
      },
      drawPile: [{ definitionId: 'hinge-jab', instanceId: 'conditional-draw' }],
      enemies: [
        {
          ...combat.enemies[0],
          statuses: { vulnerable: 1 },
        },
      ],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    expect(combat.hand.map((card) => card.definitionId)).toContain('hinge-jab');

    combat = playCard(combat, combat.hand.find((card) => card.definitionId === 'rivet-drive')!.instanceId, combat.enemies[0].instanceId);
    expect(combat.enemies[0].hp).toBeLessThanOrEqual(14);

    combat = playCard(combat, combat.hand.find((card) => card.definitionId === 'final-formula')!.instanceId, combat.enemies[0].instanceId);
    expect(combat.enemies[0].hp).toBeLessThanOrEqual(0);
  });

  it('preserves block into the next turn with blockNextTurn', () => {
    const run = startRun('m6-next-turn-block');
    let { combat } = startCombat(run, waitingEnemy);
    combat = forceHand(combat, ['sealed-breath']);

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    expect(combat.player.block).toBe(8);
    expect(combat.player.statuses.barrierLock).toBe(1);

    combat = endPlayerTurn(combat);

    expect(combat.phase).toBe('player');
    expect(combat.player.block).toBe(8);
    expect(combat.player.statuses.barrierLock).toBeUndefined();
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
