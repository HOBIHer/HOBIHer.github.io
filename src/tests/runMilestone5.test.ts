import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '../adapters/settingsAdapter';
import { enemyGroupById } from '../game/data/enemies/groups';
import { canEnterNode } from '../game/engine/map';
import {
  completeCombatNode,
  enterMapNode,
  failRun,
  leaveRestNode,
  resolveReward,
  restAtNode,
  skipCardReward,
  startNewRun,
} from '../game/engine/run';
import { generateNodeReward } from '../game/engine/rewards';
import { leaveShopNode } from '../game/engine/shop';
import { resolveEventChoice } from '../game/engine/events';
import { useGameStore } from '../game/store/useGameStore';
import type { MapNodeType, RunState } from '../game/types';

describe('milestone 5 rewards and run flow', () => {
  afterEach(() => {
    useGameStore.setState({
      screen: 'mainMenu',
      settingsReturnScreen: 'mainMenu',
      run: undefined,
      combat: undefined,
      rewards: [],
      pendingReward: undefined,
      settings: defaultSettings,
      runHistory: [],
      lastRunSummary: undefined,
      canContinueRun: false,
    });
  });

  it('generates normal combat rewards with 3 unique cards and 10 to 15 gold', () => {
    const run = startNewRun('normal-reward');
    const reward = generateNodeReward(run, run.map[0]);

    expect(reward.cardChoices).toHaveLength(3);
    expect(new Set(reward.cardChoices).size).toBe(3);
    expect(reward.gold).toBeGreaterThanOrEqual(10);
    expect(reward.gold).toBeLessThanOrEqual(15);
    expect(reward.claimed).toBe(false);
  });

  it('generates elite rewards with 20 to 30 gold and attempts a relic', () => {
    const run = startNewRun('elite-reward');
    const eliteNode = run.map.find((node) => node.type === 'elite')!;
    const reward = generateNodeReward(run, eliteNode);

    expect(reward.cardChoices).toHaveLength(3);
    expect(reward.gold).toBeGreaterThanOrEqual(20);
    expect(reward.gold).toBeLessThanOrEqual(30);
    expect(reward.relicChoices.length).toBeGreaterThanOrEqual(1);
  });

  it('resolves a selected card, adds gold, prevents duplicate claims, and completes the node', () => {
    let run = startNewRun('resolve-reward');
    const firstNode = getEnterableNode(run, 'combat');
    run = enterMapNode(run, firstNode.id);
    run = forceVictory(run);
    run = completeCombatNode(run);
    const cardId = run.pendingReward!.cardChoices[0];
    const gold = run.pendingReward!.gold;
    const nodeId = run.pendingReward!.sourceNodeId;

    run = resolveReward(run, cardId);
    const deckSize = run.deck.length;
    const goldAfterClaim = run.character.gold;
    run = resolveReward(run, cardId);
    const nextNodes = run.map.filter((node) => firstNode.nextNodeIds?.includes(node.id));

    expect(run.deck.some((card) => card.definitionId === cardId)).toBe(true);
    expect(run.character.gold).toBe(gold);
    expect(run.character.gold).toBe(goldAfterClaim);
    expect(run.deck).toHaveLength(deckSize);
    expect(run.completedNodeIds).toContain(nodeId);
    expect(nextNodes.every((node) => node.status === 'available')).toBe(true);
    expect(nextNodes.every((node) => canEnterNode(run.map, node.id))).toBe(true);
  });

  it('skips card rewards without adding the card but still completes the node and grants gold', () => {
    let run = startNewRun('skip-reward');
    const firstNode = getEnterableNode(run, 'combat');
    run = enterMapNode(run, firstNode.id);
    run = forceVictory(run);
    run = completeCombatNode(run);
    const skippedCard = run.pendingReward!.cardChoices[0];
    const gold = run.pendingReward!.gold;

    run = skipCardReward(run);

    expect(run.deck.some((card) => card.definitionId === skippedCard)).toBe(false);
    expect(run.character.gold).toBe(gold);
    expect(run.map.find((node) => node.id === firstNode.id)?.status).toBe('completed');
  });

  it('restores 30% max HP at rest, records the rest result, and does not exceed max HP', () => {
    let run = advanceToRest(startNewRun('rest-recovery'));
    run = {
      ...run,
      character: {
        ...run.character,
        hp: 50,
      },
    };
    run = enterMapNode(run, getEnterableNode(run, 'rest').id);
    run = restAtNode(run);

    expect(run.character.hp).toBe(71);
    expect(run.currentScreen).toBe('rest');
    expect(run.lastRestResult).toMatchObject({
      beforeHp: 50,
      afterHp: 71,
      healed: 21,
    });

    let cappedRun = advanceToRest(startNewRun('rest-cap'));
    cappedRun = {
      ...cappedRun,
      character: {
        ...cappedRun.character,
        hp: 70,
      },
    };
    cappedRun = enterMapNode(cappedRun, getEnterableNode(cappedRun, 'rest').id);
    cappedRun = restAtNode(cappedRun);

    expect(cappedRun.character.hp).toBe(72);
    expect(cappedRun.lastRestResult?.healed).toBe(2);
  });

  it('marks rest completed, unlocks next nodes, and can return to the map', () => {
    let run = advanceToRest(startNewRun('rest-unlock'));
    const restNode = getEnterableNode(run, 'rest');
    run = enterMapNode(run, restNode.id);
    run = restAtNode(run);
    const nextNodeIds = new Set(restNode.nextNodeIds);
    const nextNodes = run.map.filter((node) => nextNodeIds.has(node.id));

    expect(run.map.find((node) => node.id === restNode.id)?.status).toBe('completed');
    expect(nextNodes.length).toBeGreaterThan(0);
    expect(nextNodes.every((node) => node.status === 'available')).toBe(true);
    expect(nextNodes.every((node) => canEnterNode(run.map, node.id))).toBe(true);
    expect(run.runLog).toContain('完成整理节点');

    run = leaveRestNode(run);

    expect(run.currentScreen).toBe('map');
    expect(run.currentNodeId).toBeUndefined();
  });

  it('starts the act boss combat and advances to the next act after boss reward resolution', () => {
    let run = advanceToBoss(startNewRun('boss-flow'));
    const bossNode = getEnterableNode(run, 'boss');

    run = enterMapNode(run, bossNode.id);

    const bossGroup = enemyGroupById[bossNode.enemyGroupId!];
    expect(bossGroup.act).toBe(1);
    expect(bossGroup.nodeType).toBe('boss');
    expect(run.currentCombat?.enemies.map((enemy) => enemy.definitionId)).toEqual(bossGroup.enemyIds);

    run = forceVictory(run);
    run = completeCombatNode(run);
    run = resolveReward(run);

    expect(run.status).toBe('active');
    expect(run.currentScreen).toBe('event');
    expect(run.act).toBe(2);
    expect(run.currentEvent?.kind).toBe('major');
    expect(run.character.hp).toBeGreaterThanOrEqual(Math.ceil(run.character.maxHp * 0.9));
  });

  it('sets defeat status through failRun', () => {
    let run = startNewRun('defeat-flow');
    run = enterMapNode(run, getEnterableNode(run, 'combat').id);
    run = {
      ...run,
      currentCombat: {
        ...run.currentCombat!,
        phase: 'lost',
        player: {
          ...run.currentCombat!.player,
          hp: 0,
        },
      },
    };

    run = failRun(run);

    expect(run.status).toBe('defeat');
    expect(run.currentScreen).toBe('defeat');
    expect(run.currentSummary?.status).toBe('defeat');
  });

  it('records victory and defeat summaries in local run history through the store', () => {
    let bossRewardRun = advanceToBoss(startNewRun('history-victory'));
    bossRewardRun = enterMapNode(bossRewardRun, getEnterableNode(bossRewardRun, 'boss').id);
    bossRewardRun = forceVictory(bossRewardRun);
    bossRewardRun = completeCombatNode(bossRewardRun);
    bossRewardRun = { ...bossRewardRun, act: 3 };

    useGameStore.setState({
      screen: 'reward',
      run: bossRewardRun,
      combat: bossRewardRun.currentCombat,
      pendingReward: bossRewardRun.pendingReward,
      rewards: [],
      runHistory: [],
    });
    useGameStore.getState().claimReward();

    expect(useGameStore.getState().run?.status).toBe('victory');
    expect(useGameStore.getState().runHistory[0].status).toBe('victory');

    let defeatRun = startNewRun('history-defeat');
    defeatRun = enterMapNode(defeatRun, getEnterableNode(defeatRun, 'combat').id);
    const lostCombat = {
      ...defeatRun.currentCombat!,
      phase: 'lost' as const,
      player: {
        ...defeatRun.currentCombat!.player,
        hp: 0,
      },
    };

    useGameStore.setState({
      screen: 'combat',
      run: { ...defeatRun, currentCombat: lostCombat },
      combat: lostCombat,
      runHistory: [],
    });
    useGameStore.getState().endTurn();

    expect(useGameStore.getState().run?.status).toBe('defeat');
    expect(useGameStore.getState().runHistory[0].status).toBe('defeat');
  });
});

function advanceToRest(run: RunState): RunState {
  return advanceUntilEnterable(run, 'rest');
}

function advanceToBoss(run: RunState): RunState {
  let nextRun = advanceToRest(run);
  nextRun = enterMapNode(nextRun, getEnterableNode(nextRun, 'rest').id);
  nextRun = restAtNode(nextRun);
  return advanceUntilEnterable(nextRun, 'boss');
}

function completeEnterableCombat(run: RunState, type: 'combat' | 'elite'): RunState {
  let nextRun = enterMapNode(run, getEnterableNode(run, type).id);
  nextRun = forceVictory(nextRun);
  nextRun = completeCombatNode(nextRun);
  return skipCardReward(nextRun);
}

function getEnterableNode(run: RunState, type: MapNodeType) {
  const node = findEnterableNode(run, type);
  if (!node) {
    throw new Error(`No enterable ${type} node.`);
  }

  return node;
}

function findEnterableNode(run: RunState, type: MapNodeType) {
  return run.map.find((candidate) => candidate.type === type && canEnterNode(run.map, candidate.id));
}

function advanceUntilEnterable(run: RunState, type: MapNodeType): RunState {
  let nextRun = run;
  let guard = 0;
  while (!findEnterableNode(nextRun, type) && guard < 60) {
    guard += 1;
    nextRun = completeFirstEnterableNode(nextRun);
  }
  return nextRun;
}

function completeFirstEnterableNode(run: RunState): RunState {
  const node = run.map.find((candidate) => candidate.type !== 'boss' && canEnterNode(run.map, candidate.id));
  if (!node) {
    throw new Error('No enterable non-boss node.');
  }

  if (node.type === 'rest') {
    return restAtNode(enterMapNode(run, node.id));
  }

  if (node.type === 'shop') {
    return leaveShopNode(enterMapNode(run, node.id));
  }

  if (node.type === 'event') {
    const eventRun = enterMapNode(run, node.id);
    const choice = eventRun.currentEvent?.choices.find((candidate) => candidate.status === 'available');
    return choice ? resolveEventChoice(eventRun, choice.id) : eventRun;
  }

  let nextRun = enterMapNode(run, node.id);
  nextRun = forceVictory(nextRun);
  nextRun = completeCombatNode(nextRun);
  return skipCardReward(nextRun);
}

function forceVictory(run: RunState): RunState {
  return {
    ...run,
    currentCombat: {
      ...run.currentCombat!,
      phase: 'won',
    },
  };
}
