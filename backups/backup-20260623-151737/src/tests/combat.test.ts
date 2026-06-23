import { describe, expect, it } from 'vitest';
import { trainingEnemies } from '../game/data/enemies/training';
import { endPlayerTurn, playCard, startCombat, startRun } from '../game/engine/combat';
import { generateCardRewards } from '../game/engine/rewards';

describe('combat loop', () => {
  it('starts a run and draws an opening hand', () => {
    const run = startRun('opening-hand');
    const started = startCombat(run, trainingEnemies[0]);

    expect(started.run.character.name).toBe('铁誓者');
    expect(started.combat.phase).toBe('player');
    expect(started.combat.energy).toBe(3);
    expect(started.combat.hand).toHaveLength(5);
    expect(started.combat.drawPile).toHaveLength(5);
    expect(started.combat.enemies[0].name).toBe('训练木偶');
  });

  it('plays a card, spends energy, and moves the card to discard', () => {
    const run = startRun('play-card');
    let { combat } = startCombat(run, trainingEnemies[0]);
    const attack = combat.hand.find((card) => card.definitionId === 'short-blade-advance');

    expect(attack).toBeDefined();

    combat = playCard(combat, attack!.instanceId, combat.enemies[0].instanceId);

    expect(combat.energy).toBe(2);
    expect(combat.enemies[0].hp).toBe(22);
    expect(combat.discardPile.some((card) => card.instanceId === attack!.instanceId)).toBe(true);
  });

  it('ends the turn, resolves enemy intent, discards hand, and starts next player turn', () => {
    const run = startRun('enemy-turn');
    let { combat } = startCombat(run, trainingEnemies[0]);

    combat = endPlayerTurn(combat);

    expect(combat.phase).toBe('player');
    expect(combat.turn).toBe(2);
    expect(combat.player.hp).toBe(67);
    expect(combat.player.block).toBe(0);
    expect(combat.energy).toBe(3);
    expect(combat.hand.length).toBeGreaterThan(0);
    expect(combat.discardPile.length).toBeGreaterThan(0);
  });

  it('enters reward flow after victory and can generate deterministic card rewards', () => {
    const run = startRun('victory');
    let { combat } = startCombat(run, {
      ...trainingEnemies[0],
      maxHp: 6,
    });
    const attack = combat.hand.find((card) => card.definitionId === 'short-blade-advance');

    expect(attack).toBeDefined();

    combat = playCard(combat, attack!.instanceId, combat.enemies[0].instanceId);
    const rewardResult = generateCardRewards(run);

    expect(combat.phase).toBe('won');
    expect(rewardResult.rewards).toHaveLength(3);
    expect(rewardResult.rewards.every((reward) => reward.type === 'card')).toBe(true);
  });
});
