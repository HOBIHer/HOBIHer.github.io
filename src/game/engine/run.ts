import { enemyGroupById, selectEnemyGroup } from '../data/enemies/groups';
import { trainingEnemyById } from '../data/enemies/training';
import { relics } from '../data/relics/relics';
import type { CombatStartSnapshot, CombatState, MapNode, RelicId, RunState, RunStatus, RunSummary } from '../types';
import { isCombatWon, startCombat, startRun } from './combat';
import { canEnterNode, createBranchingMap, isBossNode, isRunComplete, markNodeCompleted } from './map';
import { generateNodeReward } from './rewards';

export function startNewRun(seed: string | number = Date.now()): RunState {
  const run = startRun(seed);
  const map = createBranchingMap(String(seed));

  return {
    ...run,
    status: 'active',
    currentScreen: 'map',
    map,
    currentNodeId: undefined,
    pendingReward: undefined,
    completedNodeIds: [],
    act: 1,
    floor: 1,
    currentCombat: undefined,
    combatStartSnapshot: undefined,
    lastRestResult: undefined,
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

  const group = chooseEnemyGroup(runOnNode, node);
  const enemies = group.enemyIds.map((enemyId) => {
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
  if (!node || node.type === 'rest') {
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

  const map = markNodeCompleted(run.map, reward.sourceNodeId);
  const nextRun: RunState = {
    ...run,
    character: {
      ...run.character,
      gold: run.character.gold + reward.gold,
    },
    deck: shouldAddCard ? [...run.deck, selectedCardId!] : run.deck,
    relics: shouldAddRelic ? [...run.relics, selectedRelic as RelicId] : run.relics,
    combatsWon: node.type === 'rest' ? run.combatsWon : run.combatsWon + 1,
    map,
    currentNodeId: undefined,
    pendingReward: undefined,
    completedNodeIds: appendUnique(run.completedNodeIds, reward.sourceNodeId),
    currentCombat: undefined,
    combatStartSnapshot: undefined,
    lastRestResult: undefined,
  };

  if (isBossNode(node) || isRunComplete(map)) {
    return completeRun(nextRun);
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
  const healAmount = Math.max(1, Math.floor(run.character.maxHp * 0.3));
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
      beforeHp,
      afterHp: nextHp,
      healed: nextHp - beforeHp,
    },
    runLog: [...run.runLog, '完成整理节点'],
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
    currentNodeId: snapshot.nodeId,
    currentScreen: 'combat',
    floor: snapshot.floor,
    pendingReward: undefined,
    currentCombat: snapshot.combat,
  };
}

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
    completedAt,
    turnsTaken: run.currentCombat?.turn,
    lowProfileTitle: status === 'victory' ? '流程完成' : '流程中止',
  };
}

function chooseEnemyGroup(run: RunState, node: MapNode) {
  if (node.type === 'rest') {
    throw new Error('Rest nodes do not have enemy groups.');
  }

  if (node.enemyGroupId && enemyGroupById[node.enemyGroupId]) {
    return enemyGroupById[node.enemyGroupId];
  }

  return selectEnemyGroup(node.type, `${run.seed}:${run.floor}:${node.id}`);
}

function markNodeCurrent(map: MapNode[], nodeId: string): MapNode[] {
  const selected = map.find((node) => node.id === nodeId);
  const selectedFloor = selected?.floor ?? selected?.index;

  return map.map((node) => {
    if (node.id === nodeId) {
      return { ...node, status: 'current' };
    }

    const nodeFloor = node.floor ?? node.index;
    if (nodeFloor === selectedFloor && node.status === 'available') {
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
    combat,
  };
}

function appendUnique<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values : [...values, value];
}
