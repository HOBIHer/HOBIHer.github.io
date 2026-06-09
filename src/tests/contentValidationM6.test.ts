import { describe, expect, it } from 'vitest';
import { warriorCards, rewardWarriorCards } from '../game/data/cards/warrior';
import { enemyGroups } from '../game/data/enemies/groups';
import { bossEnemies, eliteEnemies, normalTrainingEnemies, trainingEnemies } from '../game/data/enemies/training';
import { relics } from '../game/data/relics/relics';
import {
  CARD_REWARD_RARITY_WEIGHTS,
  RELIC_REWARD_RARITY_WEIGHTS,
} from '../game/engine/rewards';
import type { CardEffect } from '../game/types';

describe('milestone 6 content validation', () => {
  it('has unique card ids and complete low-profile card fields', () => {
    expect(warriorCards.length).toBeGreaterThanOrEqual(34);
    expect(uniqueCount(warriorCards.map((card) => card.id))).toBe(warriorCards.length);

    for (const card of warriorCards) {
      expect(card.name).toBeTruthy();
      expect(card.lowProfileName).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.lowProfileDescription).toBeTruthy();
      expect(card.rarity).toBeTruthy();
      expect(card.cost === 'X' || Number.isFinite(card.cost)).toBe(true);
      expect(card.target).toBeTruthy();
      expect(card.effects.length).toBeGreaterThan(0);
    }
  });

  it('puts every non-starter card in the reward pool', () => {
    const rewardEligibleIds = warriorCards
      .filter((card) => card.rarity !== 'starter' && card.rarity !== 'basic')
      .map((card) => card.id)
      .sort();
    const rewardIds = rewardWarriorCards.map((card) => card.id).sort();

    expect(rewardIds).toEqual(rewardEligibleIds);
    expect(rewardWarriorCards.every((card) => card.rarity !== 'starter' && card.rarity !== 'basic')).toBe(true);
  });

  it('has unique enemies, low-profile names, and data-driven intent patterns', () => {
    expect(normalTrainingEnemies.length).toBeGreaterThanOrEqual(9);
    expect(eliteEnemies.length).toBeGreaterThanOrEqual(4);
    expect(bossEnemies.length).toBeGreaterThanOrEqual(2);
    expect(uniqueCount(trainingEnemies.map((enemy) => enemy.id))).toBe(trainingEnemies.length);

    for (const enemy of trainingEnemies) {
      expect(enemy.lowProfileName).toBeTruthy();
      expect(enemy.intentPattern.length).toBeGreaterThan(0);
      const moveIds = new Set(enemy.moves.map((move) => move.id));
      expect(enemy.intentPattern.every((moveId) => moveIds.has(moveId))).toBe(true);
    }
  });

  it('has enough legal enemy groups and references existing enemies by node type', () => {
    expect(enemyGroups.filter((group) => group.nodeType === 'combat')).toHaveLength(8);
    expect(enemyGroups.filter((group) => group.nodeType === 'elite')).toHaveLength(4);
    expect(enemyGroups.filter((group) => group.nodeType === 'boss')).toHaveLength(2);
    expect(uniqueCount(enemyGroups.map((group) => group.id))).toBe(enemyGroups.length);

    const normalIds = new Set(normalTrainingEnemies.map((enemy) => enemy.id));
    const eliteIds = new Set(eliteEnemies.map((enemy) => enemy.id));
    const bossIds = new Set(bossEnemies.map((enemy) => enemy.id));

    for (const group of enemyGroups) {
      expect(group.lowProfileName).toBeTruthy();
      expect(group.enemyIds.length).toBeGreaterThan(0);
      expect(group.weight).toBeGreaterThan(0);
      const legalIds =
        group.nodeType === 'combat' ? normalIds : group.nodeType === 'elite' ? eliteIds : bossIds;
      expect(group.enemyIds.every((enemyId) => legalIds.has(enemyId))).toBe(true);
    }
  });

  it('has unique relic ids, low-profile fields, rarity, and legal triggers', () => {
    expect(relics.length).toBeGreaterThanOrEqual(17);
    expect(uniqueCount(relics.map((relic) => relic.id))).toBe(relics.length);

    const legalHooks = new Set([
      'onCombatStart',
      'onTurnStart',
      'onTurnEnd',
      'onCardPlayed',
      'onAttackPlayed',
      'onSkillPlayed',
      'onEnemyKilled',
      'onShuffle',
      'onVictory',
    ]);

    for (const relic of relics) {
      expect(relic.lowProfileName).toBeTruthy();
      expect(relic.description).toBeTruthy();
      expect(relic.lowProfileDescription).toBeTruthy();
      expect(['common', 'uncommon', 'rare']).toContain(relic.rarity);
      expect(relic.triggers.length).toBeGreaterThan(0);
      expect(relic.triggers.every((trigger) => legalHooks.has(trigger.hook))).toBe(true);
      expect(relic.triggers.every((trigger) => trigger.effects.length > 0)).toBe(true);
    }
  });

  it('documents reward rarity weights for cards and relics', () => {
    expect(CARD_REWARD_RARITY_WEIGHTS.combat).toEqual({
      common: 70,
      uncommon: 25,
      rare: 5,
      ancient: 1,
    });
    expect(CARD_REWARD_RARITY_WEIGHTS.elite).toEqual({
      common: 55,
      uncommon: 35,
      rare: 10,
      ancient: 2,
    });
    expect(RELIC_REWARD_RARITY_WEIGHTS).toEqual({
      common: 65,
      uncommon: 28,
      rare: 7,
    });
  });

  it('includes the milestone 6 effect descriptors in card data', () => {
    const effectTypes = new Set(warriorCards.flatMap((card) => flattenEffects(card.effects)));

    expect(effectTypes).toContain('gainEnergy');
    expect(effectTypes).toContain('loseHp');
    expect(effectTypes).toContain('heal');
    expect(effectTypes).toContain('damageAll');
    expect(effectTypes).toContain('conditional');
    expect(effectTypes).toContain('exhaustSelf');
    expect(effectTypes).toContain('blockNextTurn');
  });
});

function uniqueCount(values: string[]): number {
  return new Set(values).size;
}

function flattenEffects(effects: CardEffect[]): string[] {
  return effects.flatMap((effect) => {
    if (effect.type === 'conditional') {
      return [
        effect.type,
        ...flattenEffects(effect.effects),
        ...flattenEffects(effect.elseEffects ?? []),
      ];
    }

    return [effect.type];
  });
}
