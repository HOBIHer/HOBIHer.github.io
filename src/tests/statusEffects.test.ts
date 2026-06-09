import { describe, expect, it } from 'vitest';
import { trainingEnemies } from '../game/data/enemies/training';
import { endPlayerTurn, playCard, startCombat, startRun } from '../game/engine/combat';
import { resolveEnemyEffect } from '../game/engine/effects';
import type { CombatState, EnemyDefinition } from '../game/types';

const waitingEnemy: EnemyDefinition = {
  id: 'waiting-test-enemy',
  name: '静置靶',
  lowProfileName: '静置事项',
  maxHp: 30,
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
  };
}

describe('status effects', () => {
  it('weak lowers attack damage', () => {
    const run = startRun('weak-test');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['short-blade-advance']);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        statuses: { weak: 1 },
      },
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].hp).toBe(24);
  });

  it('vulnerable increases received attack damage', () => {
    const run = startRun('vulnerable-test');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['short-blade-advance']);
    combat = {
      ...combat,
      enemies: [
        {
          ...combat.enemies[0],
          statuses: { vulnerable: 1 },
        },
      ],
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].hp).toBe(19);
  });

  it('frail lowers block gain', () => {
    const run = startRun('frail-test');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['guarded-stance']);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        statuses: { frail: 1 },
      },
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.player.block).toBe(3);
  });

  it('dexterity increases block gain', () => {
    const run = startRun('dexterity-test');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = forceHand(combat, ['guarded-stance']);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        statuses: { dexterity: 2 },
      },
    };

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.player.block).toBe(7);
  });

  it('artifact cancels one negative status', () => {
    const run = startRun('artifact-test');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        statuses: { artifact: 1 },
      },
    };

    combat = resolveEnemyEffect(combat, combat.enemies[0].instanceId, {
      type: 'applyStatus',
      status: 'weak',
      amount: 2,
      target: 'player',
    });

    expect(combat.player.statuses.weak).toBeUndefined();
    expect(combat.player.statuses.artifact).toBeUndefined();
  });

  it('thorns retaliates when attacked', () => {
    const run = startRun('thorns-test');
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        statuses: { thorns: 2 },
      },
    };

    combat = resolveEnemyEffect(combat, combat.enemies[0].instanceId, {
      type: 'damage',
      amount: 5,
      target: 'player',
    });

    expect(combat.player.hp).toBe(67);
    expect(combat.enemies[0].hp).toBe(26);
  });

  it('bleed causes life loss at turn end', () => {
    const run = startRun('bleed-test');
    let { combat } = startCombat(run, waitingEnemy);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        statuses: { bleed: 3 },
      },
    };

    combat = endPlayerTurn(combat);

    expect(combat.player.hp).toBe(69);
    expect(combat.player.statuses.bleed).toBe(2);
  });

  it('regen heals at turn end and decays', () => {
    const run = startRun('regen-test');
    let { combat } = startCombat(run, waitingEnemy);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        hp: 60,
        statuses: { regen: 4 },
      },
    };

    combat = endPlayerTurn(combat);

    expect(combat.player.hp).toBe(64);
    expect(combat.player.statuses.regen).toBe(3);
  });

  it('barrierLock preserves block at turn start', () => {
    const run = startRun('barrier-lock-test');
    let { combat } = startCombat(run, waitingEnemy);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        block: 7,
        statuses: { barrierLock: 1 },
      },
    };

    combat = endPlayerTurn(combat);

    expect(combat.phase).toBe('player');
    expect(combat.player.block).toBe(7);
    expect(combat.player.statuses.barrierLock).toBeUndefined();
  });
});
