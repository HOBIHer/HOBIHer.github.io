import { describe, expect, it } from 'vitest';
import {
  canEnterNode,
  createBranchingMap,
  createLinearMap,
  isRunComplete,
  markNodeCompleted,
} from '../game/engine/map';

describe('branching map engine', () => {
  it('creates a deterministic upward tree with multiple starts and one boss', () => {
    const map = createBranchingMap('map-seed');
    const layers = new Set(map.map((node) => node.layer));
    const starts = map.filter((node) => node.parentNodeIds.length === 0);
    const bosses = map.filter((node) => node.type === 'boss');

    expect(map).toHaveLength(12);
    expect(layers.size).toBeGreaterThanOrEqual(5);
    expect(starts).toHaveLength(3);
    expect(starts.every((node) => node.status === 'available')).toBe(true);
    expect(bosses).toHaveLength(1);
    expect(bosses[0].label).toBe('最终 Boss');
    expect(map.some((node) => node.type === 'elite')).toBe(true);
    expect(map.some((node) => node.type === 'rest')).toBe(true);
    expect(createLinearMap('map-seed')).toEqual(map);
  });

  it('only allows start nodes at run start', () => {
    const map = createBranchingMap('entry-seed');
    const starts = map.filter((node) => node.parentNodeIds.length === 0);
    const nonStarts = map.filter((node) => node.parentNodeIds.length > 0);

    expect(starts.every((node) => canEnterNode(map, node.id))).toBe(true);
    expect(nonStarts.every((node) => !canEnterNode(map, node.id))).toBe(true);
    expect(nonStarts.every((node) => node.status === 'locked')).toBe(true);
  });

  it('unlocks all next branch nodes after completion', () => {
    const map = createBranchingMap('unlock-seed');
    const start = map.find((node) => node.parentNodeIds.length === 0)!;
    const nextMap = markNodeCompleted(map, start.id);
    const nextNodeIds = new Set(start.nextNodeIds);
    const unlocked = nextMap.filter((node) => nextNodeIds.has(node.id));

    expect(nextMap.find((node) => node.id === start.id)?.status).toBe('completed');
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
