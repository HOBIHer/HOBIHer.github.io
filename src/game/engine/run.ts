import { enemyGroupById, selectEnemyGroup } from '../data/enemies/groups';
import { trainingEnemyById } from '../data/enemies/training';
import { relics } from '../data/relics/relics';
import type { ActNumber, AscensionLevel, CombatStartSnapshot, CombatState, MapNode, RelicId, RunState, RunStatus, RunSummary } from '../types';
import {
  getRestHealAmount,
  getStartingPotionSlots,
  hasAscension,
} from './ascension';
import { isCombatWon, startCombat, startRun } from './combat';
import { canUpgradeCardInstance, getBaseCardDefinition, getEffectiveCardDefinition, upgradeCardInstance } from './cardUpgrades';
import { createRewardCardInstance } from './deck';
import { createActStartEvent, enterEventNode, restartEventFromSnapshot } from './events';
import { canEnterNode, createBranchingMap, isBossNode, isRunComplete, markNodeCompleted } from './map';
import { createPotionInstance } from './potions';
import { generateNodeReward } from './rewards';
import { enterShopNode } from './shop';

export function startNewRun(
  seed: string | number = Date.now(),
  ascensionLevel: AscensionLevel = 0,
): RunState {
  const run = startRun(seed, undefined, ascensionLevel);
  const map = createBranchingMap(String(seed), ascensionLevel, 1);
  const deck = hasAscension(ascensionLevel, 5)
    ? [...run.deck, createRewardCardInstance('v140-ascension-burden', `${run.id}-ascension-burden`)]
    : run.deck;
  const runWithMap: RunState = {
    ...run,
    deck,
    status: 'active',
    currentScreen: 'map',
    map,
    currentNodeId: undefined,
    pendingReward: undefined,
    completedNodeIds: [],
    act: 1,
    floor: 1,
    potions: [],
    potionSlots: getStartingPotionSlots(ascensionLevel),
    currentCombat: undefined,
    combatStartSnapshot: undefined,
    currentShop: undefined,
    currentEvent: undefined,
    eventStartSnapshot: undefined,
    shopStartSnapshot: undefined,
    seenEventIds: [],
    lastRestResult: undefined,
  };
  const event = createActStartEvent(runWithMap, 1);

  return {
    ...runWithMap,
    currentScreen: 'event',
    currentEvent: event,
    eventStartSnapshot: {
      id: `${runWithMap.id}-act1-event-start`,
      eventSeed: event.seed,
      run: {
        ...runWithMap,
        currentScreen: 'event',
        currentEvent: event,
        eventStartSnapshot: undefined,
        shopStartSnapshot: undefined,
      },
    },
  };
}

export function enterMapNode(run: RunState, nodeId: string): RunState {
  if (run.status !== 'active' || !canEnterNode(run.map, nodeId)) {
    return run;
  }

  const node = run.map.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return run;
  }

  const map = markNodeCurrent(run.map, nodeId);
  const floor = node.floor ?? node.index + 1;
  const runOnNode: RunState = {
    ...run,
    map,
    currentNodeId: nodeId,
    floor,
    pendingReward: undefined,
    lastRestResult: undefined,
  };

  if (node.type === 'rest') {
    return {
      ...runOnNode,
      currentScreen: 'rest',
      currentCombat: undefined,
    };
  }

  if (node.type === 'shop') {
    return enterShopNode(runOnNode, node);
  }

  if (node.type === 'event') {
    return enterEventNode(runOnNode, node);
  }

  const group = chooseEnemyGroup(runOnNode, node);
  const enemyIds =
    node.type === 'boss' && hasAscension(runOnNode.ascensionLevel, 10)
      ? [...group.enemyIds, ...group.enemyIds]
      : group.enemyIds;
  const enemies = enemyIds.map((enemyId) => {
    const enemy = trainingEnemyById[enemyId];
    if (!enemy) {
      throw new Error(`Unknown enemy id in group ${group.id}: ${enemyId}`);
    }
    return enemy;
  });

  const mapWithGroup = map.map((candidate) =>
    candidate.id === nodeId
      ? {
          ...candidate,
          enemyGroupId: group.id,
          bossId: node.type === 'boss' ? enemies[0]?.id : candidate.bossId,
        }
      : candidate,
  );

  const started = startCombat({ ...runOnNode, map: mapWithGroup }, enemies);
  const combatStartSnapshot = createCombatStartSnapshot(
    {
      ...started.run,
      map: mapWithGroup,
      currentNodeId: nodeId,
      floor,
    },
    started.combat,
    nodeId,
  );

  return {
    ...started.run,
    map: mapWithGroup,
    currentNodeId: nodeId,
    currentScreen: 'combat',
    floor,
    currentCombat: started.combat,
    combatStartSnapshot,
  };
}

export function completeCombatNode(run: RunState): RunState {
  if (!run.currentCombat || !isCombatWon(run.currentCombat) || !run.currentNodeId) {
    return run;
  }

  const node = run.map.find((candidate) => candidate.id === run.currentNodeId);
  if (!node || node.type === 'rest' || node.type === 'shop') {
    return run;
  }

  const pendingReward = generateNodeReward(run, node);

  return {
    ...run,
    character: {
      ...run.character,
      hp: Math.max(0, run.currentCombat.player.hp),
    },
    currentScreen: 'reward',
    pendingReward,
    combatStartSnapshot: undefined,
  };
}

export function resolveReward(
  run: RunState,
  selectedCardId?: string,
  selectedRelicId?: string,
): RunState {
  const reward = run.pendingReward;
  if (!reward || reward.claimed) {
    return run;
  }

  const node = run.map.find((candidate) => candidate.id === reward.sourceNodeId);
  if (!node) {
    return run;
  }

  const selectedRelic = selectedRelicId ?? (reward.relicChoices.length === 1 ? reward.relicChoices[0] : undefined);
  const relicPool = new Set(relics.map((relic) => relic.id));
  const shouldAddCard = Boolean(selectedCardId && reward.cardChoices.includes(selectedCardId));
  const shouldAddRelic = Boolean(
    selectedRelic &&
      reward.relicChoices.includes(selectedRelic) &&
      relicPool.has(selectedRelic as RelicId) &&
      !run.relics.includes(selectedRelic as RelicId),
  );
  const shouldAddPotion = Boolean(reward.potionId && run.potions.length < run.potionSlots);

  const map = markNodeCompleted(run.map, reward.sourceNodeId);
  let nextRun: RunState = {
    ...run,
    character: {
      ...run.character,
      gold: run.character.gold + reward.gold,
    },
    deck: shouldAddCard
      ? [...run.deck, createRewardCardInstance(selectedCardId!, `${run.id}-reward-${run.deck.length}`)]
      : run.deck,
    relics: shouldAddRelic ? [...run.relics, selectedRelic as RelicId] : run.relics,
    potions: shouldAddPotion
      ? [
          ...run.potions,
          createPotionInstance(reward.potionId!, `${run.id}-potion-${run.potions.length}-${reward.sourceNodeId}`),
        ]
      : run.potions,
    combatsWon: node.type === 'rest' ? run.combatsWon : run.combatsWon + 1,
    map,
    currentNodeId: undefined,
    pendingReward: undefined,
    completedNodeIds: appendUnique(run.completedNodeIds, reward.sourceNodeId),
    currentCombat: undefined,
    combatStartSnapshot: undefined,
    lastRestResult: undefined,
  };
  nextRun = removeExpiredCombatCurses(nextRun);

  if (isBossNode(node) || isRunComplete(map)) {
    return nextRun.act >= 3 ? completeRun(nextRun) : startNextAct(nextRun);
  }

  return {
    ...nextRun,
    currentScreen: 'map',
  };
}

export function skipCardReward(run: RunState): RunState {
  return resolveReward(run);
}

export function restAtNode(run: RunState): RunState {
  if (!run.currentNodeId) {
    return run;
  }

  const node = run.map.find((candidate) => candidate.id === run.currentNodeId);
  if (!node || node.type !== 'rest' || node.status === 'completed') {
    return run;
  }

  const beforeHp = run.character.hp;
    const healAmount = getRestHealAmount(run.character.maxHp, run.ascensionLevel);
  const nextHp = Math.min(run.character.maxHp, run.character.hp + healAmount);
  const map = markNodeCompleted(run.map, node.id);

  return {
    ...run,
    character: {
      ...run.character,
      hp: nextHp,
    },
    map,
    currentNodeId: node.id,
    completedNodeIds: appendUnique(run.completedNodeIds, node.id),
    currentScreen: 'rest',
    lastRestResult: {
      nodeId: node.id,
      action: 'rest',
      beforeHp,
      afterHp: nextHp,
      healed: nextHp - beforeHp,
    },
    runLog: [...run.runLog, '完成整理节点'],
  };
}

export function upgradeCardAtNode(run: RunState, cardInstanceId: string): RunState {
  if (!run.currentNodeId) {
    return run;
  }

  const node = run.map.find((candidate) => candidate.id === run.currentNodeId);
  if (!node || node.type !== 'rest' || node.status === 'completed') {
    return run;
  }

  const targetCard = run.deck.find((card) => card.instanceId === cardInstanceId);
  if (!targetCard || !canUpgradeCardInstance(targetCard)) {
    return run;
  }

  const definition = getBaseCardDefinition(targetCard.definitionId);
  const beforeDefinition = getBaseCardDefinition(targetCard.definitionId);
  const upgradedCard = upgradeCardInstance(targetCard);
  const upgradedDefinition = getEffectiveCardDefinition(upgradedCard);
  const map = markNodeCompleted(run.map, node.id);

  return {
    ...run,
    deck: run.deck.map((card) =>
      card.instanceId === cardInstanceId ? upgradedCard : card,
    ),
    map,
    currentNodeId: node.id,
    completedNodeIds: appendUnique(run.completedNodeIds, node.id),
    currentScreen: 'rest',
    lastRestResult: {
      nodeId: node.id,
      action: 'upgrade',
      beforeHp: run.character.hp,
      afterHp: run.character.hp,
      healed: 0,
      upgradedCardInstanceId: cardInstanceId,
      upgradedCardDefinitionId: targetCard.definitionId,
      upgradedCardName: definition.name,
      upgradedLowProfileName: definition.lowProfileName,
      upgradeBeforeDescription: beforeDefinition.description,
      upgradeAfterDescription: upgradedDefinition.description,
      upgradeBeforeLowProfileDescription: beforeDefinition.lowProfileDescription,
      upgradeAfterLowProfileDescription: upgradedDefinition.lowProfileDescription,
      upgradeBeforeCost: beforeDefinition.cost,
      upgradeAfterCost: upgradedDefinition.cost,
    },
    runLog: [...run.runLog, `${definition.name} 已升级`],
  };
}

export function leaveRestNode(run: RunState): RunState {
  if (!run.lastRestResult) {
    return run;
  }

  return {
    ...run,
    currentScreen: 'map',
    currentNodeId: undefined,
    lastRestResult: undefined,
  };
}

export function completeRun(run: RunState): RunState {
  const completedAt = new Date().toISOString();
  const summary = createRunSummary(run, 'victory', completedAt);

  return {
    ...run,
    status: 'victory',
    currentScreen: 'victory',
    currentSummary: summary,
    pendingReward: undefined,
    currentCombat: undefined,
    combatStartSnapshot: undefined,
    lastRestResult: undefined,
  };
}

export function failRun(run: RunState): RunState {
  const completedAt = new Date().toISOString();
  const runWithHp = run.currentCombat
    ? {
        ...run,
        character: {
          ...run.character,
          hp: Math.max(0, run.currentCombat.player.hp),
        },
      }
    : run;
  const summary = createRunSummary(runWithHp, 'defeat', completedAt);

  return {
    ...runWithHp,
    status: 'defeat',
    currentScreen: 'defeat',
    currentSummary: summary,
    combatStartSnapshot: undefined,
    lastRestResult: undefined,
  };
}

export function restartCombatFromSnapshot(run: RunState): RunState {
  const snapshot = run.combatStartSnapshot;
  if (!snapshot) {
    return run;
  }

  return {
    ...run,
    rngSeed: snapshot.rngSeed,
    character: {
      ...run.character,
      hp: snapshot.characterHp,
    },
    map: snapshot.map,
    potions: snapshot.potions,
    currentNodeId: snapshot.nodeId,
    currentScreen: 'combat',
    floor: snapshot.floor,
    pendingReward: undefined,
    currentCombat: snapshot.combat,
  };
}

export function restartShopFromSnapshot(run: RunState): RunState {
  const snapshot = run.shopStartSnapshot;
  return snapshot ? snapshot.run : run;
}

export { restartEventFromSnapshot };

export function createRunSummary(
  run: RunState,
  status: Exclude<RunStatus, 'active'>,
  completedAt: string = new Date().toISOString(),
): RunSummary {
  return {
    id: `${run.id}-${status}-${completedAt}`,
    seed: run.seed,
    characterClassId: run.character.id,
    status,
    floorReached: run.floor,
    finalHp: Math.max(0, run.character.hp),
    maxHp: run.character.maxHp,
    gold: run.character.gold,
    deckSize: run.deck.length,
    relicCount: run.relics.length,
    ascensionLevel: run.ascensionLevel,
    completedAt,
    turnsTaken: run.currentCombat?.turn,
    lowProfileTitle: status === 'victory' ? '流程完成' : '流程中止',
  };
}

function chooseEnemyGroup(run: RunState, node: MapNode) {
  if (node.type === 'rest' || node.type === 'shop' || node.type === 'event') {
    throw new Error('Non-combat nodes do not have enemy groups.');
  }

  if (node.enemyGroupId && enemyGroupById[node.enemyGroupId]) {
    const group = enemyGroupById[node.enemyGroupId];
    if (group.act === getRunAct(run) && group.nodeType === node.type) {
      return group;
    }
  }

  return selectEnemyGroup(node.type, `${run.seed}:${run.act}:${run.floor}:${node.id}`, getRunAct(run));
}

function startNextAct(run: RunState): RunState {
  const nextAct = run.act + 1;
  const map = createBranchingMap(`${run.seed}:act:${nextAct}`, run.ascensionLevel, nextAct);
  const targetHp = Math.ceil(run.character.maxHp * 0.9);
  const runAtActStart: RunState = {
    ...run,
    act: nextAct,
    floor: 1,
    map,
    currentNodeId: undefined,
    currentCombat: undefined,
    currentShop: undefined,
    pendingReward: undefined,
    combatStartSnapshot: undefined,
    shopStartSnapshot: undefined,
    eventStartSnapshot: undefined,
    completedNodeIds: [],
    character: {
      ...run.character,
      hp: Math.min(run.character.maxHp, Math.max(run.character.hp, targetHp)),
    },
  };
  const event = createActStartEvent(runAtActStart, nextAct);
  return {
    ...runAtActStart,
    currentScreen: 'event',
    currentEvent: event,
    eventStartSnapshot: {
      id: `${run.id}-act${nextAct}-event-start`,
      eventSeed: event.seed,
      run: {
        ...runAtActStart,
        currentScreen: 'event',
        currentEvent: event,
        eventStartSnapshot: undefined,
      },
    },
    runLog: [...run.runLog, `进入第 ${nextAct} 幕。`],
  };
}

function removeExpiredCombatCurses(run: RunState): RunState {
  let removed = 0;
  const deck = run.deck
    .map((card) =>
      typeof card.remainingCombats === 'number'
        ? { ...card, remainingCombats: card.remainingCombats - 1 }
        : card,
    )
    .filter((card) => {
      const keep = typeof card.remainingCombats !== 'number' || card.remainingCombats > 0;
      if (!keep) {
        removed += 1;
      }
      return keep;
    });

  return removed > 0 ? { ...run, deck, runLog: [...run.runLog, `自动移除 ${removed} 张临时诅咒。`] } : run;
}

function markNodeCurrent(map: MapNode[], nodeId: string): MapNode[] {
  const selected = map.find((node) => node.id === nodeId);
  const selectedLayer = selected?.layer ?? selected?.floor ?? selected?.index;

  return map.map((node) => {
    if (node.id === nodeId) {
      return { ...node, status: 'current' };
    }

    const nodeLayer = node.layer ?? node.floor ?? node.index;
    if (nodeLayer === selectedLayer && node.status === 'available') {
      return { ...node, status: 'locked' };
    }

    return node;
  });
}

function createCombatStartSnapshot(
  run: RunState,
  combat: CombatState,
  nodeId: string,
): CombatStartSnapshot {
  return {
    id: `${run.id}-${nodeId}-combat-start`,
    nodeId,
    floor: run.floor,
    rngSeed: run.rngSeed,
    characterHp: combat.player.hp,
    map: run.map,
    potions: run.potions,
    combat,
  };
}

function appendUnique<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values : [...values, value];
}

function getRunAct(run: RunState): ActNumber {
  if (run.act <= 1) {
    return 1;
  }

  if (run.act === 2) {
    return 2;
  }

  return 3;
}
