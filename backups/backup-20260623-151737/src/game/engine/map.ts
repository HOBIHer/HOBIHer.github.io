import { selectEnemyGroup } from '../data/enemies/groups';
import { normalizeSeed } from '../rng';
import type { ActNumber, AscensionLevel, MapNode, MapNodeType } from '../types';
import { hasAscension } from './ascension';

interface MapNodePlan {
  key: string;
  index: number;
  layer: number;
  x: number;
  type: MapNodeType;
  nextKeys: string[];
}

const EXTRA_ASCENSION_ELITE_KEYS = new Set(['l1-c', 'l5-b', 'l8-c']);

const TREE_NODE_PLAN: MapNodePlan[] = [
  { key: 'start-left', index: 0, layer: 0, x: 0, type: 'combat', nextKeys: ['l1-a', 'l1-b'] },
  { key: 'start-mid', index: 1, layer: 0, x: 1, type: 'combat', nextKeys: ['l1-b', 'l1-c'] },
  { key: 'start-right', index: 2, layer: 0, x: 2, type: 'combat', nextKeys: ['l1-c', 'l1-d'] },
  { key: 'l1-a', index: 3, layer: 1, x: 0, type: 'combat', nextKeys: ['l2-a', 'l2-b'] },
  { key: 'l1-b', index: 4, layer: 1, x: 0.7, type: 'combat', nextKeys: ['l2-b', 'l2-c'] },
  { key: 'l1-c', index: 5, layer: 1, x: 1.4, type: 'combat', nextKeys: ['l2-c', 'l2-d'] },
  { key: 'l1-d', index: 6, layer: 1, x: 2.1, type: 'combat', nextKeys: ['l2-d'] },
  { key: 'l2-a', index: 7, layer: 2, x: 0.1, type: 'shop', nextKeys: ['l3-a', 'l3-b'] },
  { key: 'l2-b', index: 8, layer: 2, x: 0.8, type: 'event', nextKeys: ['l3-a', 'l3-b'] },
  { key: 'l2-c', index: 9, layer: 2, x: 1.5, type: 'elite', nextKeys: ['l3-b', 'l3-c'] },
  { key: 'l2-d', index: 10, layer: 2, x: 2.2, type: 'shop', nextKeys: ['l3-c'] },
  { key: 'l3-a', index: 11, layer: 3, x: 0.35, type: 'combat', nextKeys: ['l4-a', 'l4-b'] },
  { key: 'l3-b', index: 12, layer: 3, x: 1.1, type: 'rest', nextKeys: ['l4-a', 'l4-b', 'l4-c'] },
  { key: 'l3-c', index: 13, layer: 3, x: 1.85, type: 'combat', nextKeys: ['l4-b', 'l4-c'] },
  { key: 'l4-a', index: 14, layer: 4, x: 0.25, type: 'elite', nextKeys: ['l5-a'] },
  { key: 'l4-b', index: 15, layer: 4, x: 1.1, type: 'combat', nextKeys: ['l5-a', 'l5-b'] },
  { key: 'l4-c', index: 16, layer: 4, x: 1.95, type: 'elite', nextKeys: ['l5-b', 'l5-c'] },
  { key: 'l5-a', index: 17, layer: 5, x: 0.45, type: 'shop', nextKeys: ['l6-a', 'l6-b'] },
  { key: 'l5-b', index: 18, layer: 5, x: 1.2, type: 'combat', nextKeys: ['l6-b', 'l6-c'] },
  { key: 'l5-c', index: 19, layer: 5, x: 1.95, type: 'rest', nextKeys: ['l6-c', 'l6-d'] },
  { key: 'l6-a', index: 20, layer: 6, x: 0.15, type: 'combat', nextKeys: ['l7-a', 'l7-b'] },
  { key: 'l6-b', index: 21, layer: 6, x: 0.85, type: 'elite', nextKeys: ['l7-a', 'l7-b'] },
  { key: 'l6-c', index: 22, layer: 6, x: 1.55, type: 'event', nextKeys: ['l7-b', 'l7-c'] },
  { key: 'l6-d', index: 23, layer: 6, x: 2.25, type: 'shop', nextKeys: ['l7-c'] },
  { key: 'l7-a', index: 24, layer: 7, x: 0.4, type: 'rest', nextKeys: ['l8-a'] },
  { key: 'l7-b', index: 25, layer: 7, x: 1.15, type: 'combat', nextKeys: ['l8-a', 'l8-b', 'l8-c'] },
  { key: 'l7-c', index: 26, layer: 7, x: 1.9, type: 'elite', nextKeys: ['l8-c'] },
  { key: 'l8-a', index: 27, layer: 8, x: 0.35, type: 'combat', nextKeys: ['l9-a', 'l9-b'] },
  { key: 'l8-b', index: 28, layer: 8, x: 1.15, type: 'shop', nextKeys: ['l9-b'] },
  { key: 'l8-c', index: 29, layer: 8, x: 1.95, type: 'combat', nextKeys: ['l9-b', 'l9-c'] },
  { key: 'l9-a', index: 30, layer: 9, x: 0.35, type: 'elite', nextKeys: ['l10-a'] },
  { key: 'l9-b', index: 31, layer: 9, x: 1.15, type: 'event', nextKeys: ['l10-a', 'l10-b'] },
  { key: 'l9-c', index: 32, layer: 9, x: 1.95, type: 'elite', nextKeys: ['l10-b'] },
  { key: 'l10-a', index: 33, layer: 10, x: 0.75, type: 'rest', nextKeys: ['l11-a', 'l11-b'] },
  { key: 'l10-b', index: 34, layer: 10, x: 1.55, type: 'shop', nextKeys: ['l11-b', 'l11-c'] },
  { key: 'l11-a', index: 35, layer: 11, x: 0.45, type: 'combat', nextKeys: ['l12-a'] },
  { key: 'l11-b', index: 36, layer: 11, x: 1.2, type: 'elite', nextKeys: ['l12-a', 'l12-b'] },
  { key: 'l11-c', index: 37, layer: 11, x: 1.95, type: 'combat', nextKeys: ['l12-b'] },
  { key: 'l12-a', index: 38, layer: 12, x: 0.8, type: 'rest', nextKeys: ['boss'] },
  { key: 'l12-b', index: 39, layer: 12, x: 1.55, type: 'combat', nextKeys: ['boss'] },
  { key: 'boss', index: 40, layer: 13, x: 1.2, type: 'boss', nextKeys: [] },
];

const labels: Record<MapNodeType, { label: string; lowProfileLabel: string }> = {
  combat: { label: '普通战斗', lowProfileLabel: '常规会话' },
  elite: { label: '精英战斗', lowProfileLabel: '重点事项' },
  event: { label: '事件', lowProfileLabel: '流程事项' },
  rest: { label: '休整点', lowProfileLabel: '整理节点' },
  shop: { label: '商店', lowProfileLabel: '资源面板' },
  boss: { label: '最终 Boss', lowProfileLabel: '最终议题' },
};

export function createTreeMap(seed: string, ascensionLevel: AscensionLevel = 0, act = 1): MapNode[] {
  const seedId = normalizeSeed(seed).toString(36);
  const actNumber = normalizeAct(act);
  const bossGroup = selectEnemyGroup('boss', `${seed}:boss:${actNumber}`, actNumber);
  const idByKey = Object.fromEntries(
    TREE_NODE_PLAN.map((node) => [node.key, `act${act}-${seedId}-${node.index + 1}-${node.key}`]),
  );

  const parentKeysByKey = new Map<string, string[]>();
  for (const node of TREE_NODE_PLAN) {
    for (const nextKey of node.nextKeys) {
      parentKeysByKey.set(nextKey, [...(parentKeysByKey.get(nextKey) ?? []), node.key]);
    }
  }

  return TREE_NODE_PLAN.map((node) => {
    const parentKeys = parentKeysByKey.get(node.key) ?? [];
    const type = getNodeType(node, ascensionLevel);
    return {
      id: idByKey[node.key],
      index: node.index,
      floor: node.layer + 1,
      layer: node.layer,
      x: node.x,
      y: node.layer,
      type,
      label: labels[type].label,
      lowProfileLabel: labels[type].lowProfileLabel,
      status: parentKeys.length === 0 ? 'available' : 'locked',
      parentNodeIds: parentKeys.map((key) => idByKey[key]),
      nextNodeIds: node.nextKeys.map((key) => idByKey[key]),
      enemyGroupId: type === 'boss' ? bossGroup.id : undefined,
      bossId: type === 'boss' ? bossGroup.enemyIds[0] : undefined,
    };
  });
}

export function createBranchingMap(seed: string, ascensionLevel: AscensionLevel = 0, act = 1): MapNode[] {
  return createTreeMap(seed, ascensionLevel, act);
}

export function createLinearMap(seed: string): MapNode[] {
  return createTreeMap(seed);
}

export function getCurrentNode(map: MapNode[]): MapNode | undefined {
  return map.find((node) => node.status === 'available');
}

export function canEnterNode(map: MapNode[], nodeId: string): boolean {
  const node = map.find((candidate) => candidate.id === nodeId);
  if (!node || node.status !== 'available') {
    return false;
  }

  if (node.parentNodeIds.length === 0) {
    return true;
  }

  return node.parentNodeIds.some((parentId) => {
    const parent = map.find((candidate) => candidate.id === parentId);
    return parent?.status === 'completed';
  });
}

export function markNodeCompleted(map: MapNode[], nodeId: string): MapNode[] {
  const completedNode = map.find((node) => node.id === nodeId);
  if (!completedNode) {
    return map;
  }

  const nextNodeIds = new Set(completedNode.nextNodeIds);

  return map.map((node) => {
    if (node.id === nodeId) {
      return { ...node, status: 'completed' };
    }

    if (nextNodeIds.has(node.id) && node.status === 'locked') {
      return { ...node, status: 'available' };
    }

    return node;
  });
}

export function getNextNode(map: MapNode[], nodeId: string): MapNode | undefined {
  return getNextNodes(map, nodeId)[0];
}

export function getNextNodes(map: MapNode[], nodeId: string): MapNode[] {
  const node = map.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return [];
  }

  const nextIds = new Set(node.nextNodeIds);
  return map.filter((candidate) => nextIds.has(candidate.id));
}

export function isBossNode(node: MapNode): boolean {
  return node.type === 'boss';
}

export function isRunComplete(map: MapNode[]): boolean {
  return map.some((node) => isBossNode(node) && node.status === 'completed');
}

function getNodeType(node: MapNodePlan, ascensionLevel: AscensionLevel): MapNodeType {
  if (hasAscension(ascensionLevel, 1) && EXTRA_ASCENSION_ELITE_KEYS.has(node.key)) {
    return 'elite';
  }

  return node.type;
}

function normalizeAct(act: number): ActNumber {
  if (act <= 1) {
    return 1;
  }

  if (act === 2) {
    return 2;
  }

  return 3;
}
