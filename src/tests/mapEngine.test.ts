import { describe, expect, it } from 'vitest';
import {
  canEnterNode,
  createBranchingMap,
  createLinearMap,
  isRunComplete,
  markNodeCompleted,
} from '../game/engine/map';

describe('branching map engine', () => {
  it('creates a deterministic act 1 route with combat, elite, rest, and boss nodes', () => {
    const map = createBranchingMap('map-seed');
    const floors = new Set(map.map((node) => node.floor));

    expect(map).toHaveLength(9);
    expect(floors.size).toBeGreaterThanOrEqual(5);
    expect(map[0].type).toBe('combat');
    expect(map.filter((node) => node.floor === 2 && node.type === 'combat')).toHaveLength(2);
    expect(map.some((node) => node.type === 'elite')).toBe(true);
    expect(map.some((node) => node.type === 'rest')).toBe(true);
    expect(map.at(-1)?.type).toBe('boss');
    expect(createLinearMap('map-seed')).toEqual(map);
  });

  it('only allows the first node at run start', () => {
    const map = createBranchingMap('entry-seed');

    expect(canEnterNode(map, map[0].id)).toBe(true);
    expect(map.slice(1).every((node) => !canEnterNode(map, node.id))).toBe(true);
    expect(map.slice(1).every((node) => node.status === 'locked')).toBe(true);
  });

  it('unlocks all next branch nodes after completion', () => {
    const map = createBranchingMap('unlock-seed');
    const nextMap = markNodeCompleted(map, map[0].id);
    const nextNodeIds = new Set(map[0].nextNodeIds);
    const unlocked = nextMap.filter((node) => nextNodeIds.has(node.id));

    expect(nextMap[0].status).toBe('completed');
    expect(unlocked).toHaveLength(2);
    expect(unlocked.every((node) => node.status === 'available')).toBe(true);
    expect(unlocked.every((node) => canEnterNode(nextMap, node.id))).toBe(true);
  });

  it('does not allow available-looking nodes whose predecessor is incomplete', () => {
    const map = createBranchingMap('blocked-branch').map((node) =>
      node.type === 'elite' ? { ...node, status: 'available' as const } : node,
    );
    const elite = map.find((node) => node.type === 'elite')!;

    expect(canEnterNode(map, elite.id)).toBe(false);
  });

  it('marks the run complete when the boss node is completed', () => {
    const map = createBranchingMap('boss-seed').map((node) =>
      node.type === 'boss' ? { ...node, status: 'completed' as const } : node,
    );

    expect(isRunComplete(map)).toBe(true);
  });
});
