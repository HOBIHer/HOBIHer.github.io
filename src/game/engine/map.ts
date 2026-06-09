import { normalizeSeed } from '../rng';
import type { MapNode, MapNodeType } from '../types';

interface MapNodePlan {
  key: string;
  index: number;
  floor: number;
  type: MapNodeType;
  nextKeys: string[];
}

const BRANCHING_NODE_PLAN: MapNodePlan[] = [
  { key: 'start', index: 0, floor: 1, type: 'combat', nextKeys: ['left-combat', 'right-combat'] },
  { key: 'left-combat', index: 1, floor: 2, type: 'combat', nextKeys: ['left-elite', 'center-combat'] },
  { key: 'right-combat', index: 2, floor: 2, type: 'combat', nextKeys: ['center-combat', 'right-elite'] },
  { key: 'left-elite', index: 3, floor: 3, type: 'elite', nextKeys: ['left-rest'] },
  { key: 'center-combat', index: 4, floor: 3, type: 'combat', nextKeys: ['left-rest', 'right-rest'] },
  { key: 'right-elite', index: 5, floor: 3, type: 'elite', nextKeys: ['right-rest'] },
  { key: 'left-rest', index: 6, floor: 4, type: 'rest', nextKeys: ['boss'] },
  { key: 'right-rest', index: 7, floor: 4, type: 'rest', nextKeys: ['boss'] },
  { key: 'boss', index: 8, floor: 5, type: 'boss', nextKeys: [] },
];

const labels: Record<MapNodeType, { label: string; lowProfileLabel: string }> = {
  combat: { label: '普通战斗', lowProfileLabel: '常规会话' },
  elite: { label: '精英战斗', lowProfileLabel: '重点事项' },
  rest: { label: '休整点', lowProfileLabel: '整理节点' },
  boss: { label: 'Boss', lowProfileLabel: '最终议题' },
};

export function createBranchingMap(seed: string): MapNode[] {
  const seedId = normalizeSeed(seed).toString(36);
  const idByKey = Object.fromEntries(
    BRANCHING_NODE_PLAN.map((node) => [node.key, `act1-${seedId}-${node.index + 1}-${node.key}`]),
  );

  return BRANCHING_NODE_PLAN.map((node) => ({
    id: idByKey[node.key],
    index: node.index,
    floor: node.floor,
    type: node.type,
    label: labels[node.type].label,
    lowProfileLabel: labels[node.type].lowProfileLabel,
    status: node.index === 0 ? 'current' : 'locked',
    nextNodeIds: node.nextKeys.map((key) => idByKey[key]),
    enemyGroupId: node.type === 'boss' ? 'bell_tower_guardian_boss' : undefined,
    bossId: node.type === 'boss' ? 'bell_tower_guardian' : undefined,
  }));
}

export function createLinearMap(seed: string): MapNode[] {
  return createBranchingMap(seed);
}

export function getCurrentNode(map: MapNode[]): MapNode | undefined {
  return map.find((node) => node.status === 'current') ?? map.find((node) => node.status === 'available');
}

export function canEnterNode(map: MapNode[], nodeId: string): boolean {
  const node = map.find((candidate) => candidate.id === nodeId);
  if (!node || (node.status !== 'current' && node.status !== 'available')) {
    return false;
  }

  const predecessors = map.filter((candidate) => candidate.nextNodeIds?.includes(nodeId));
  if (predecessors.length === 0) {
    const firstIndex = Math.min(...map.map((candidate) => candidate.index));
    return node.index === firstIndex;
  }

  return predecessors.some((candidate) => candidate.status === 'completed');
}

export function markNodeCompleted(map: MapNode[], nodeId: string): MapNode[] {
  const completedNode = map.find((node) => node.id === nodeId);
  if (!completedNode) {
    return map;
  }

  const nextNodeIds = new Set(completedNode.nextNodeIds ?? []);

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

  const nextIds = new Set(node.nextNodeIds ?? []);
  return map.filter((candidate) => nextIds.has(candidate.id));
}

export function isBossNode(node: MapNode): boolean {
  return node.type === 'boss';
}

export function isRunComplete(map: MapNode[]): boolean {
  return map.some((node) => isBossNode(node) && node.status === 'completed');
}
