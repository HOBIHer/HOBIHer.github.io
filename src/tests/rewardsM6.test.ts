import { describe, expect, it } from 'vitest';
import { relics } from '../game/data/relics/relics';
import { enemyGroups, selectEnemyGroup } from '../game/data/enemies/groups';
import { generateNodeReward } from '../game/engine/rewards';
import { startNewRun } from '../game/engine/run';

describe('milestone 6 reward and group selection', () => {
  it('generates deterministic non-starter card rewards without duplicates', () => {
    const run = startNewRun('weighted-reward');
    const rewardA = generateNodeReward(run, run.map[0]);
    const rewardB = generateNodeReward(run, run.map[0]);

    expect(rewardA).toEqual(rewardB);
    expect(rewardA.cardChoices).toHaveLength(3);
    expect(new Set(rewardA.cardChoices).size).toBe(3);
    expect(rewardA.cardChoices.every((cardId) => !['short-blade-advance', 'guarded-stance', 'break-stance-smash'].includes(cardId))).toBe(true);
  });

  it('generates elite relic rewards without owned relics and handles an empty relic pool', () => {
    const run = startNewRun('elite-relic-reward');
    const eliteNode = run.map.find((node) => node.type === 'elite')!;
    const eliteReward = generateNodeReward(run, eliteNode);

    expect(eliteReward.relicChoices.length).toBeGreaterThanOrEqual(1);
    expect(eliteReward.relicChoices.every((relicId) => !run.relics.includes(relicId))).toBe(true);

    const fullRelicRun = {
      ...run,
      relics: relics.map((relic) => relic.id),
    };
    const emptyRelicReward = generateNodeReward(fullRelicRun, eliteNode);

    expect(emptyRelicReward.relicChoices).toEqual([]);
  });

  it('selects only groups matching node type and does so deterministically', () => {
    for (const nodeType of ['combat', 'elite', 'boss'] as const) {
      const groupA = selectEnemyGroup(nodeType, `group-seed-${nodeType}`);
      const groupB = selectEnemyGroup(nodeType, `group-seed-${nodeType}`);

      expect(groupA).toEqual(groupB);
      expect(groupA.nodeType).toBe(nodeType);
    }
  });

  it('has boss group selection backed by the boss pool', () => {
    const bossGroup = selectEnemyGroup('boss', 'boss-pool-seed');
    const bossGroups = enemyGroups.filter((group) => group.nodeType === 'boss');

    expect(bossGroups).toHaveLength(2);
    expect(bossGroups.map((group) => group.id)).toContain(bossGroup.id);
    expect(bossGroup.enemyIds.length).toBe(1);
  });
});
