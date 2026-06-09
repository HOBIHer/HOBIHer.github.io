import { normalizeSeed } from '../rng';
import type { MapNode, MapNodeType } from '../types';

interface MapNodePlan {
  key: string;
  index: number;
  layer: number;
  x: number;
  type: MapNodeType;
  nextKeys: string[];
}

const TREE_NODE_PLAN: MapNodePlan[] = [
  { key: 'start-left', index: 0, layer: 0, x: 0, type: 'combat', nextKeys: ['lower-left', 'lower-mid'] },
  { key: 'start-mid', index: 1, layer: 0, x: 1, type: 'combat', nextKeys: ['lower-mid', 'lower-right'] },
  { key: 'start-right', index: 2, layer: 0, x: 2, type: 'combat', nextKeys: ['lower-right'] },
  { key: 'lower-left', index: 3, layer: 1, x: 0.25, type: 'combat', nextKeys: ['left-elite', 'center-combat'] },
  { key: 'lower-mid', index: 4, layer: 1, x: 1, type: 'elite', nextKeys: ['left-elite', 'center-combat', 'right-elite'] },
  { key: 'lower-right', index: 5, layer: 1, x: 1.75, type: 'combat', nextKeys: ['center-combat', 'right-elite'] },
  { key: 'left-elite', index: 6, layer: 2, x: 0.35, type: 'elite', nextKeys: ['left-rest'] },
  { key: 'center-combat', index: 7, layer: 2, x: 1, type: 'combat', nextKeys: ['left-rest', 'right-rest'] },
  { key: 'right-elite', index: 8, layer: 2, x: 1.65, type: 'elite', nextKeys: ['right-rest'] },
  { key: 'left-rest', index: 9, layer: 3, x: 0.65, type: 'rest', nextKeys: ['boss'] },
  { key: 'right-rest', index: 10, layer: 3, x: 1.35, type: 'rest', nextKeys: ['boss'] },
  { key: 'boss', index: 11, layer: 4, x: 1, type: 'boss', nextKeys: [] },
];

const labels: Record<MapNodeType, { label: string; lowProfileLabel: string }> = {
  combat: { label: '普通战斗', lowProfileLabel: '常规会话' },
  elite: { label: '精英战斗', lowProfileLabel: '重点事项' },
  rest: { label: '休整点', lowProfileLabel: '整理节点' },
  boss: { label: '最终 Boss', lowProfileLabel: '最终议题' },
};

export function createTreeMap(seed: string): MapNode[] {
  const seedId = normalizeSeed(seed).toString(36);
  const idByKey = Object.fromEntries(
    TREE_NODE_PLAN.map((node) => [node.key, `act1-${seedId}-${node.index + 1}-${node.key}`]),
  );

  const parentKeysByKey = new Map<string, string[]>();
  for (const node of TREE_NODE_PLAN) {
    for (const nextKey of node.nextKeys) {
      parentKeysByKey.set(nextKey, [...(parentKeysByKey.get(nextKey) ?? []), node.key]);
    }
  }

  return TREE_NODE_PLAN.map((node) => {
    const parentKeys = parentKeysByKey.get(node.key) ?? [];
    return {
      id: idByKey[node.key],
      index: node.index,
      floor: node.layer + 1,
      layer: node.layer,
      x: node.x,
      y: node.layer,
      type: node.type,
      label: labels[node.type].label,
      lowProfileLabel: labels[node.type].lowProfileLabel,
      status: parentKeys.length === 0 ? 'available' : 'locked',
      parentNodeIds: parentKeys.map((key) => idByKey[key]),
      nextNodeIds: node.nextKeys.map((key) => idByKey[key]),
      enemyGroupId: node.type === 'boss' ? 'bell_tower_guardian_boss' : undefined,
      bossId: node.type === 'boss' ? 'bell_tower_guardian' : undefined,
    };
  });
}

export function createBranchingMap(seed: string): MapNode[] {
  return createTreeMap(seed);
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
