import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter, type StorageLike } from '../adapters/storageAdapter';
import { curseCards } from '../game/data/cards/curses';
import { minorEventDefinitions } from '../game/data/events/events';
import { trainingEnemies } from '../game/data/enemies/training';
import { endPlayerTurn, playCard, startCombat, startRun } from '../game/engine/combat';
import { createMinorEventState, resolveEventChoice } from '../game/engine/events';
import { canEnterNode } from '../game/engine/map';
import { createPotionInstance, usePotion } from '../game/engine/potions';
import {
  completeCombatNode,
  enterMapNode,
  resolveReward,
  restartEventFromSnapshot,
  restartShopFromSnapshot,
  startNewRun,
} from '../game/engine/run';
import { buyShopItem } from '../game/engine/shop';
import type { CardInstance, CombatState, CurrentRunSave, EnemyDefinition, MapNode, RunState } from '../game/types';
import { CardView } from '../ui/components/CardView';

const waitingEnemy: EnemyDefinition = {
  id: 'v150-waiter',
  name: '等待靶',
  lowProfileName: '等待事项',
  maxHp: 80,
  intentPattern: ['wait'],
  moves: [{ id: 'wait', name: '等待', intent: { type: 'wait', label: '等待' }, effects: [] }],
};

describe('v1.5.0 mechanisms, curses, events, and three-act flow', () => {
  it('resolves Plating, Buffer, Ritual, and Replay mechanics', () => {
    const attacker = trainingEnemies.find((enemy) => enemy.id === 'bell_tower_guardian')!;
    let run = startRun('v150-plating', [], 0);
    let started = startCombat({ ...run, deck: [instance('short-blade-advance', 'strike')] }, attacker);
    let combat: CombatState = {
      ...started.combat,
      player: { ...started.combat.player, statuses: { plating: 7 } },
      hand: [],
      drawPile: [],
      discardPile: [],
    };
    combat = endPlayerTurn(combat);
    expect(combat.player.hp).toBe(69);
    expect(combat.player.block).toBe(0);
    expect(combat.player.statuses.plating).toBe(6);

    started = startCombat({ ...run, deck: [instance('short-blade-advance', 'strike')] }, attacker);
    combat = {
      ...started.combat,
      player: { ...started.combat.player, statuses: { buffer: 1 } },
      hand: [],
      drawPile: [],
      discardPile: [],
    };
    combat = endPlayerTurn(combat);
    expect(combat.player.hp).toBe(72);
    expect(combat.player.statuses.buffer).toBeUndefined();

    started = startCombat({ ...run, deck: [instance('short-blade-advance', 'strike')] }, waitingEnemy);
    combat = {
      ...started.combat,
      player: { ...started.combat.player, statuses: { ritual: 2 } },
      hand: [],
      drawPile: [],
      discardPile: [],
    };
    combat = endPlayerTurn(combat);
    expect(combat.player.statuses.strength).toBe(2);

    run = {
      ...startRun('v150-replay', [], 0),
      currentScreen: 'combat',
      deck: [instance('short-blade-advance', 'strike')],
      potions: [createPotionInstance('v150-replay-etching', 'replay')],
      potionSlots: 1,
    };
    started = startCombat(run, waitingEnemy);
    let result = usePotion(started.run, started.combat, started.run.potions[0].instanceId);
    combat = {
      ...result.combat!,
      hand: [{ ...instance('short-blade-advance', 'strike-hand'), replay: 1 }],
      energy: 3,
    };
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    expect(combat.enemies[0].hp).toBe(68);
  });

  it('has complete curse definitions and resolves key curse timings', () => {
    expect(new Set(curseCards.map((card) => card.id)).size).toBe(curseCards.length);
    for (const curse of curseCards) {
      expect(curse.name).toBeTruthy();
      expect(curse.lowProfileName).toBeTruthy();
      expect(curse.description).toBeTruthy();
      expect(curse.lowProfileDescription).toBeTruthy();
      expect(curse.type).toBe('curse');
      expect(curse.rarity).toBe('curse');
    }

    let combat: CombatState = curseCombat('curse-bad-luck');
    combat = endPlayerTurn({ ...combat, hand: [instance('curse-bad-luck', 'bad')] });
    expect(combat.player.hp).toBe(59);

    combat = curseCombat('curse-debt');
    combat = endPlayerTurn({ ...combat, hand: [instance('curse-debt', 'debt')] });
    expect(combat.combatStats.goldLost).toBe(10);

    combat = curseCombat('curse-clumsy');
    combat = endPlayerTurn({ ...combat, hand: [instance('curse-clumsy', 'clumsy')] });
    expect(combat.exhaustPile.some((card) => card.definitionId === 'curse-clumsy')).toBe(true);

    combat = curseCombat('curse-poor-sleep');
    combat = endPlayerTurn({ ...combat, hand: [instance('curse-poor-sleep', 'sleep')] });
    expect(combat.hand.some((card) => card.definitionId === 'curse-poor-sleep')).toBe(true);

    combat = {
      ...curseCombat('curse-normality'),
      hand: [
        instance('curse-normality', 'normality'),
        instance('v130-echo-scratch', 'a'),
        instance('v130-echo-scratch', 'b'),
        instance('v130-echo-scratch', 'c'),
        instance('v130-echo-scratch', 'd'),
      ],
      energy: 10,
    };
    combat = playCard(combat, 'a', combat.enemies[0].instanceId);
    combat = playCard(combat, 'b', combat.enemies[0].instanceId);
    combat = playCard(combat, 'c', combat.enemies[0].instanceId);
    combat = playCard(combat, 'd', combat.enemies[0].instanceId);
    expect(combat.log.at(-1)).toContain('常态枷锁');
  });

  it('renders curses with low-profile text and unavailable cost', () => {
    const curse = curseCards.find((card) => card.id === 'curse-injury')!;
    const markup = renderToStaticMarkup(createElement(CardView, { card: curse, mode: 'stealth' }));
    expect(markup).toContain(curse.lowProfileName);
    expect(markup).toContain('异常项');
    expect(markup).toContain('—');
  });

  it('advances act1 to act2, act2 to act3, and act3 to victory after boss rewards', () => {
    let run = completeCurrentMajorEvent(startNewRun('v150-three-act'));
    expect(run.currentScreen).toBe('map');
    expect(run.act).toBe(1);

    run = completeBossReward(run);
    expect(run.act).toBe(2);
    expect(run.currentScreen).toBe('event');
    expect(run.character.hp).toBeGreaterThanOrEqual(Math.ceil(run.character.maxHp * 0.9));

    run = completeCurrentMajorEvent(run);
    run = completeBossReward(run);
    expect(run.act).toBe(3);
    expect(run.currentScreen).toBe('event');
    expect(run.character.hp).toBeGreaterThanOrEqual(Math.ceil(run.character.maxHp * 0.9));

    run = completeCurrentMajorEvent(run);
    run = completeBossReward(run);
    expect(run.status).toBe('victory');
    expect(run.currentScreen).toBe('victory');
    expect(run.currentSummary?.status).toBe('victory');
  });

  it('separates major and minor events, avoids repeats when possible, and applies event effects', () => {
    const majorRun = startNewRun('v150-events');
    expect(majorRun.currentEvent?.kind).toBe('major');

    const nodeA = eventNode(completeCurrentMajorEvent(majorRun), 'a');
    const first = createMinorEventState(completeCurrentMajorEvent(majorRun), nodeA);
    const runWithSeen = { ...completeCurrentMajorEvent(majorRun), seenEventIds: [first.eventId] };
    const second = createMinorEventState(runWithSeen, eventNode(runWithSeen, 'b'));
    expect(first.kind).toBe('minor');
    expect(second.kind).toBe('minor');
    expect(second.eventId).not.toBe(first.eventId);

    const thisOrThat = minorEventDefinitions.find((event) => event.id === 'v150-this-or-that')!;
    let run: RunState = {
      ...runWithSeen,
      currentScreen: 'event',
      currentEvent: {
        id: 'manual-this-or-that',
        eventId: thisOrThat.id,
        kind: 'minor',
        seed: 'manual-seed',
        name: thisOrThat.name,
        lowProfileName: thisOrThat.lowProfileName,
        description: thisOrThat.description,
        lowProfileDescription: thisOrThat.lowProfileDescription,
        choices: thisOrThat.choices,
        resultLog: [],
      },
    };
    run = resolveEventChoice(run, 'that');
    expect(run.deck.some((card) => card.definitionId === 'curse-clumsy')).toBe(true);
    expect(run.relics.length).toBeGreaterThan(1);
  });

  it('restores shop and event start snapshots for deterministic continue', () => {
    let run = completeCurrentMajorEvent(startNewRun('v150-sl'));
    run = { ...run, character: { ...run.character, gold: 999 } };
    const shopNode = makeEnterable(run, run.map.find((node) => node.type === 'shop')!);
    run = enterMapNode(shopNode.run, shopNode.node.id);
    const originalShop = run.currentShop!;
    const cardItem = originalShop.items.find((item) => item.type === 'card')!;
    const afterBuy = buyShopItem(run, cardItem.id);
    expect(afterBuy.character.gold).toBeLessThan(run.character.gold);
    expect(afterBuy.currentShop?.items.find((item) => item.id === cardItem.id)?.sold).toBe(true);

    const restartedShop = restartShopFromSnapshot(afterBuy);
    expect(restartedShop.character.gold).toBe(999);
    expect(restartedShop.currentShop?.items).toEqual(originalShop.items);
    expect(restartedShop.currentShop?.items.find((item) => item.id === cardItem.id)?.sold).toBe(false);

    const eventNodeResult = makeEnterable(restartedShop, restartedShop.map.find((node) => node.type === 'event')!);
    const eventRun = enterMapNode(eventNodeResult.run, eventNodeResult.node.id);
    const eventId = eventRun.currentEvent!.eventId;
    const restartedEvent = restartEventFromSnapshot(eventRun);
    expect(restartedEvent.currentEvent?.eventId).toBe(eventId);
    expect(restartedEvent.deck).toEqual(eventRun.eventStartSnapshot?.run.deck);

    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const save: CurrentRunSave = {
      screen: 'event',
      run: eventRun,
      rewards: [],
      savedAt: '2026-06-10T00:00:00.000Z',
    };
    adapter.saveRun(save);
    expect(adapter.loadRun()?.run.currentEvent?.eventId).toBe(eventId);
  });
});

function curseCombat(cardId: string): CombatState {
  const run = { ...startRun(`v150-${cardId}`, [], 0), deck: [instance(cardId, `deck-${cardId}`)] };
  return {
    ...startCombat(run, waitingEnemy).combat,
    drawPile: [],
    discardPile: [],
  };
}

function completeCurrentMajorEvent(run: RunState): RunState {
  const choice = run.currentEvent?.choices.find((candidate) => candidate.status === 'available');
  if (!choice) {
    throw new Error('No available major event choice.');
  }
  return resolveEventChoice(run, choice.id);
}

function completeBossReward(run: RunState): RunState {
  const boss = run.map.find((node) => node.type === 'boss')!;
  const ready = makeEnterable(run, boss);
  let nextRun = enterMapNode(ready.run, ready.node.id);
  nextRun = {
    ...nextRun,
    currentCombat: {
      ...nextRun.currentCombat!,
      phase: 'won',
      player: {
        ...nextRun.currentCombat!.player,
        hp: Math.max(12, Math.floor(nextRun.currentCombat!.player.maxHp * 0.45)),
      },
    },
  };
  nextRun = completeCombatNode(nextRun);
  return resolveReward(nextRun);
}

function eventNode(run: RunState, suffix: string): MapNode {
  return {
    id: `manual-event-${suffix}`,
    index: 1,
    floor: 2,
    layer: 1,
    parentNodeIds: [],
    x: 0,
    y: 0,
    type: 'event',
    label: '事件',
    lowProfileLabel: '流程事项',
    status: 'available',
    nextNodeIds: [],
  };
}

function makeEnterable(run: RunState, node: MapNode): { run: RunState; node: MapNode } {
  const map = run.map.map((candidate) => {
    if (candidate.id === node.id) {
      return { ...candidate, status: 'available' as const };
    }
    if (node.parentNodeIds.includes(candidate.id)) {
      return { ...candidate, status: 'completed' as const };
    }
    return candidate;
  });
  const nextRun = { ...run, map };
  expect(canEnterNode(nextRun.map, node.id)).toBe(true);
  return { run: nextRun, node: nextRun.map.find((candidate) => candidate.id === node.id)! };
}

function instance(definitionId: string, instanceId: string): CardInstance {
  return {
    definitionId,
    instanceId,
    upgraded: false,
  };
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
