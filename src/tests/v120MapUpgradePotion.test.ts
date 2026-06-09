import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter, type StorageLike } from '../adapters/storageAdapter';
import { potionById } from '../game/data/potions/potions';
import { warriorCards } from '../game/data/cards/warrior';
import { trainingEnemies } from '../game/data/enemies/training';
import { createUpgradedCardDefinition } from '../game/engine/cardUpgrades';
import { playCard, startCombat, startRun } from '../game/engine/combat';
import { createTreeMap, canEnterNode, markNodeCompleted } from '../game/engine/map';
import { createPotionInstance, usePotion } from '../game/engine/potions';
import {
  enterMapNode,
  completeCombatNode,
  skipCardReward,
  startNewRun,
  upgradeCardAtNode,
} from '../game/engine/run';
import { resolveReward } from '../game/engine/run';
import type { CurrentRunSave, MapNodeType, RunState } from '../game/types';
import { defaultSettings } from '../adapters/settingsAdapter';
import { MapScreenView } from '../ui/screens/MapScreen';

describe('v1.2.0 tree map, upgrades, and potions', () => {
  it('creates a tree map with multiple available starts and a single boss endpoint', () => {
    const map = createTreeMap('tree-shape');
    const starts = map.filter((node) => node.parentNodeIds.length === 0);
    const bosses = map.filter((node) => node.type === 'boss');

    expect(starts.length).toBeGreaterThan(1);
    expect(starts.every((node) => node.status === 'available')).toBe(true);
    expect(map.filter((node) => node.parentNodeIds.length > 0).every((node) => node.status === 'locked')).toBe(true);
    expect(bosses).toHaveLength(1);
    expect(bosses[0].nextNodeIds).toEqual([]);
    expect(bosses[0].layer).toBe(Math.max(...map.map((node) => node.layer)));
  });

  it('unlocks only nextNodeIds and rejects locked or completed nodes', () => {
    const map = createTreeMap('tree-unlock');
    const start = map.find((node) => node.parentNodeIds.length === 0)!;
    const nextMap = markNodeCompleted(map, start.id);
    const nextIds = new Set(start.nextNodeIds);

    expect(canEnterNode(nextMap, start.id)).toBe(false);
    expect(nextMap.filter((node) => nextIds.has(node.id)).every((node) => node.status === 'available')).toBe(true);
    expect(
      nextMap
        .filter((node) => node.parentNodeIds.length > 0 && !nextIds.has(node.id))
        .every((node) => node.status === 'locked'),
    ).toBe(true);
  });

  it('renders low-profile tree map terminology and boss label', () => {
    const markup = renderToStaticMarkup(
      createElement(MapScreenView, {
        enterMapNode: () => undefined,
        openSettings: () => undefined,
        returnToMenu: () => undefined,
        run: startNewRun('stealth-tree'),
        settings: {
          ...defaultSettings,
          mode: 'stealth',
          themeId: 'document',
        },
      }),
    );

    expect(markup).toContain('流程面板');
    expect(markup).toContain('最终议题');
  });

  it('makes every warrior card upgradeable with normal and low-profile descriptions', () => {
    for (const card of warriorCards) {
      const upgraded = createUpgradedCardDefinition(card);
      if (upgraded.cost === 'X') {
        expect(upgraded.cost).toBe('X');
      } else {
        expect(upgraded.cost).toBeGreaterThanOrEqual(0);
      }
      expect(upgraded.description.length).toBeGreaterThan(0);
      expect(upgraded.lowProfileDescription.length).toBeGreaterThan(0);
      expect(upgraded.name).toContain('+');
    }
  });

  it('upgrades a card at rest without healing and completes the node', () => {
    let run = advanceToRest(startNewRun('upgrade-rest'));
    const restNode = getEnterableNode(run, 'rest');
    run = {
      ...run,
      character: {
        ...run.character,
        hp: 30,
      },
    };
    run = enterMapNode(run, restNode.id);
    const card = run.deck.find((candidate) => !candidate.upgraded)!;
    run = upgradeCardAtNode(run, card.instanceId);

    expect(run.character.hp).toBe(30);
    expect(run.deck.find((candidate) => candidate.instanceId === card.instanceId)?.upgraded).toBe(true);
    expect(upgradeCardAtNode(run, card.instanceId)).toBe(run);
    expect(run.map.find((node) => node.id === restNode.id)?.status).toBe('completed');
    expect(run.lastRestResult?.action).toBe('upgrade');
  });

  it('uses upgraded card effects in combat', () => {
    const run = {
      ...startRun('upgraded-combat'),
      deck: [{ definitionId: 'short-blade-advance', instanceId: 'upgraded-strike', upgraded: true }],
    };
    let { combat } = startCombat(run, {
      ...trainingEnemies[0],
      maxHp: 30,
    });

    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);

    expect(combat.enemies[0].hp).toBe(21);
  });

  it('uses all basic potions in combat and removes them from the run', () => {
    let run = {
      ...startRun('potion-combat'),
      currentScreen: 'combat' as const,
      potions: [
        createPotionInstance('small-healing-fluid', 'potion-a'),
        createPotionInstance('strength-draught', 'potion-b'),
        createPotionInstance('guard-draught', 'potion-c'),
        createPotionInstance('draw-draught', 'potion-d'),
        createPotionInstance('risk-mark-bottle', 'potion-e'),
      ],
      potionSlots: 5,
    };
    let { combat } = startCombat(run, trainingEnemies[0]);
    combat = {
      ...combat,
      player: {
        ...combat.player,
        hp: 50,
      },
    };
    run = { ...run, currentCombat: combat };

    let result = usePotion(run, combat, run.potions[0].instanceId);
    expect(result.combat?.player.hp).toBe(60);
    expect(result.run.potions).toHaveLength(4);

    result = usePotion(result.run, result.combat, result.run.potions[0].instanceId);
    expect(result.combat?.player.statuses.strength).toBe(2);

    result = usePotion(result.run, result.combat, result.run.potions[0].instanceId);
    expect(result.combat?.player.block).toBe(12);

    const handBeforeDraw = result.combat!.hand.length;
    result = usePotion(result.run, result.combat, result.run.potions[0].instanceId);
    expect(result.combat!.hand.length).toBeGreaterThan(handBeforeDraw);

    result = usePotion(result.run, result.combat, result.run.potions[0].instanceId, result.combat!.enemies[0].instanceId);
    expect(result.combat?.enemies[0].statuses.vulnerable).toBe(2);
    expect(result.run.potions).toHaveLength(0);
  });

  it('does not use potions outside combat and handles full potion reward safely', () => {
    const potion = createPotionInstance('small-healing-fluid', 'map-potion');
    let run = {
      ...startNewRun('potion-map'),
      potions: [potion],
    };
    const outsideCombat = usePotion(run, undefined, potion.instanceId);

    expect(outsideCombat.run.potions).toHaveLength(1);

    run = {
      ...run,
      potions: [
        createPotionInstance('small-healing-fluid', 'full-a'),
        createPotionInstance('strength-draught', 'full-b'),
        createPotionInstance('guard-draught', 'full-c'),
      ],
      potionSlots: 3,
      pendingReward: {
        id: 'full-potion-reward',
        sourceNodeId: run.map[0].id,
        cardChoices: [],
        gold: 0,
        relicChoices: [],
        potionId: 'draw-draught',
        claimed: false,
      },
    };

    const resolved = resolveReward(run);
    expect(resolved.potions).toHaveLength(3);
  });

  it('saves and loads upgraded cards and potions locally', () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const run = {
      ...startNewRun('save-upgrades-potions'),
      deck: [{ definitionId: 'short-blade-advance', instanceId: 'saved-card', upgraded: true }],
      potions: [createPotionInstance('draw-draught', 'saved-potion')],
    };
    const save: CurrentRunSave = {
      screen: 'map',
      run,
      rewards: [],
      savedAt: '2026-06-09T00:00:00.000Z',
    };

    adapter.saveRun(save);
    const loaded = adapter.loadRun();

    expect(loaded?.run.deck[0].upgraded).toBe(true);
    expect(loaded?.run.potions[0].definitionId).toBe('draw-draught');
    expect(loaded?.run.potionSlots).toBe(3);
  });
});

function advanceToRest(run: RunState): RunState {
  let nextRun = completeEnterableCombat(run, 'combat');
  nextRun = completeEnterableCombat(nextRun, 'combat');
  return completeEnterableCombat(nextRun, 'elite');
}

function completeEnterableCombat(run: RunState, type: 'combat' | 'elite'): RunState {
  let nextRun = enterMapNode(run, getEnterableNode(run, type).id);
  nextRun = {
    ...nextRun,
    currentCombat: {
      ...nextRun.currentCombat!,
      phase: 'won',
    },
  };
  nextRun = completeCombatNode(nextRun);
  return skipCardReward(nextRun);
}

function getEnterableNode(run: RunState, type: MapNodeType) {
  const node = run.map.find((candidate) => candidate.type === type && canEnterNode(run.map, candidate.id));
  if (!node) {
    throw new Error(`No enterable ${type} node.`);
  }

  return node;
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
