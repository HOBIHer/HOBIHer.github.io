import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter, type StorageLike } from '../adapters/storageAdapter';
import { potionById, potions } from '../game/data/potions/potions';
import { trainingEnemies } from '../game/data/enemies/training';
import { relics } from '../game/data/relics/relics';
import { canEnterNode } from '../game/engine/map';
import { endPlayerTurn, playCard, startCombat, startRun } from '../game/engine/combat';
import { triggerDeathWardPotion, createPotionInstance, pickPotion, usePotion } from '../game/engine/potions';
import { enterMapNode, restAtNode, startNewRun } from '../game/engine/run';
import { buyShopItem, createShopState, leaveShopNode } from '../game/engine/shop';
import { PotionBar } from '../ui/components/PotionBar';
import type { CurrentRunSave, MapNode, RunState } from '../game/types';

describe('v1.4.0 potion, ascension, shop, and starter relic systems', () => {
  it('has unique complete potion definitions and exposes them through the potion pool', () => {
    const ids = potions.map((potion) => potion.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const potion of potions) {
      expect(potion.name.length).toBeGreaterThan(0);
      expect(potion.lowProfileName.length).toBeGreaterThan(0);
      expect(potion.description.length).toBeGreaterThan(0);
      expect(potion.lowProfileDescription.length).toBeGreaterThan(0);
      expect(potion.rarity).toBeTruthy();
      expect(potion.target).toBeTruthy();
      expect(potion.effects.length).toBeGreaterThan(0);
    }

    const rewardPool = potions.filter((potion) => potion.rarity !== 'event' && potion.rarity !== 'token');
    const picked = new Set(rewardPool.map((_, seed) => pickPotion(seed)));
    expect(picked.size).toBe(rewardPool.length);
  });

  it('renders low-profile potion names and descriptions', () => {
    const potion = createPotionInstance('v140-overdrive-lens', 'low-profile');
    const markup = renderToStaticMarkup(
      createElement(PotionBar, {
        potions: [potion],
        potionSlots: 1,
        mode: 'stealth',
        onUse: () => undefined,
      }),
    );

    expect(markup).toContain(potionById['v140-overdrive-lens'].lowProfileName);
    expect(markup).toContain(potionById['v140-overdrive-lens'].lowProfileDescription);
  });

  it('resolves key potion mechanics in combat', () => {
    let run: RunState = {
      ...startRun('v140-potions'),
      currentScreen: 'combat' as const,
      deck: [{ definitionId: 'short-blade-advance', instanceId: 'strike', upgraded: false }],
      potions: [
        createPotionInstance('v140-field-refit-fluid', 'upgrade'),
        createPotionInstance('v140-overdrive-lens', 'triple'),
        createPotionInstance('v140-dimming-vapor', 'dimming'),
      ],
      potionSlots: 3,
    };
    let started = startCombat(run, trainingEnemies[0]);
    run = started.run;
    let combat = started.combat;

    let result = usePotion(run, combat, run.potions[0].instanceId);
    run = result.run;
    combat = result.combat!;
    expect(combat.hand.every((card) => card.upgraded)).toBe(true);

    result = usePotion(run, combat, run.potions[0].instanceId);
    run = result.run;
    combat = result.combat!;
    combat = playCard(combat, combat.hand[0].instanceId, combat.enemies[0].instanceId);
    expect(combat.enemies[0].hp).toBe(1);
    expect(combat.player.statuses.nextAttackDamageMultiplier).toBeUndefined();

    result = usePotion({ ...run, currentCombat: combat }, combat, run.potions[0].instanceId);
    combat = result.combat!;
    expect(combat.enemies[0].statuses.enemyAttackDown30).toBe(4);
  });

  it('handles delayed block, corrosive leak, and death ward potion edges', () => {
    let run: RunState = {
      ...startRun('v140-potion-edges'),
      currentScreen: 'combat' as const,
      potions: [createPotionInstance('v140-delayed-guard-vial', 'guard')],
      potionSlots: 1,
    };
    let started = startCombat(run, trainingEnemies[0]);
    let result = usePotion(started.run, started.combat, started.run.potions[0].instanceId);
    let combat = endPlayerTurn(result.combat!);
    expect(combat.phase).toBe('player');
    expect(combat.player.block).toBe(10);

    run = {
      ...startRun('v140-corrosion'),
      currentScreen: 'combat' as const,
      potions: [createPotionInstance('v140-corrosion-vial', 'corrode')],
      potionSlots: 1,
    };
    started = startCombat(run, trainingEnemies[0]);
    result = usePotion(started.run, started.combat, started.run.potions[0].instanceId);
    combat = endPlayerTurn(result.combat!);
    expect(combat.enemies[0].hp).toBe(trainingEnemies[0].maxHp - 9);

    run = {
      ...startRun('v140-death-ward'),
      currentScreen: 'combat' as const,
      potions: [createPotionInstance('v140-second-heart-phial', 'ward')],
      potionSlots: 1,
    };
    started = startCombat(run, trainingEnemies[0]);
    const ward = triggerDeathWardPotion(started.run, {
      ...started.combat,
      phase: 'lost',
      player: { ...started.combat.player, hp: 0 },
    });
    expect(ward.triggered).toBe(true);
    expect(ward.combat.player.hp).toBe(Math.floor(started.combat.player.maxHp * 0.3));
    expect(ward.run.potions).toHaveLength(0);
  });

  it('applies stacked ascension restrictions to run setup, rest, enemies, and boss entry', () => {
    const baseRun = startNewRun('v140-asc-base', 0);
    let run = startNewRun('v140-asc-high', 10);

    expect(run.potionSlots).toBe(2);
    expect(run.deck.some((card) => card.definitionId === 'v140-ascension-burden')).toBe(true);
    expect(run.map.filter((node) => node.type === 'elite').length).toBeGreaterThan(
      baseRun.map.filter((node) => node.type === 'elite').length,
    );

    run = { ...run, character: { ...run.character, hp: 20 } };
    const restNode = makeEnterable(run, run.map.find((node) => node.type === 'rest')!);
    run = restAtNode(enterMapNode(restNode.run, restNode.node.id));
    expect(run.lastRestResult?.healed).toBe(Math.floor(Math.floor(72 * 0.3) * 0.8));

    const baseCombat = startCombat(startRun('enemy-base', [], 0), trainingEnemies[0]).combat;
    const highCombat = startCombat(startRun('enemy-high', [], 9), trainingEnemies[0]).combat;
    expect(highCombat.enemies[0].maxHp).toBeGreaterThan(baseCombat.enemies[0].maxHp);
    expect(endPlayerTurn(highCombat).player.hp).toBeLessThan(endPlayerTurn(baseCombat).player.hp);

    const boss = run.map.find((node) => node.type === 'boss')!;
    const bossReady = makeEnterable(run, boss);
    const bossRun = enterMapNode(bossReady.run, bossReady.node.id);
    expect(bossRun.currentCombat?.enemies.length).toBeGreaterThanOrEqual(2);
  });

  it('creates deterministic shops, buys items safely, and persists shop state in saves', () => {
    let run: RunState = {
      ...startNewRun('v140-shop'),
      character: { ...startNewRun('v140-shop').character, gold: 999 },
    };
    const shopNode = run.map.find((node) => node.type === 'shop')!;
    const shop = createShopState(run, shopNode);
    expect(createShopState(run, shopNode)).toEqual(shop);
    expect(shop.items.some((item) => item.type === 'card')).toBe(true);
    expect(shop.items.some((item) => item.type === 'relic')).toBe(true);
    expect(shop.items.some((item) => item.type === 'potion')).toBe(true);

    run = { ...run, currentShop: shop, shops: { [shop.nodeId]: shop } };
    const cardItem = shop.items.find((item) => item.type === 'card')!;
    run = buyShopItem(run, cardItem.id);
    expect(run.deck.some((card) => card.definitionId === cardItem.refId)).toBe(true);
    expect(run.currentShop?.items.find((item) => item.id === cardItem.id)?.sold).toBe(true);

    const potionItem = run.currentShop!.items.find((item) => item.type === 'potion')!;
    run = {
      ...run,
      potions: Array.from({ length: run.potionSlots }, (_, index) =>
        createPotionInstance('small-healing-fluid', `full-${index}`),
      ),
    };
    const afterFullPotionBuy = buyShopItem(run, potionItem.id);
    expect(afterFullPotionBuy.potions).toHaveLength(run.potionSlots);
    expect(afterFullPotionBuy.currentShop?.items.find((item) => item.id === potionItem.id)?.sold).toBe(false);

    run = leaveShopNode({
      ...run,
      currentShop: run.currentShop,
      currentNodeId: shopNode.id,
    });
    expect(run.map.find((node) => node.id === shopNode.id)?.status).toBe('completed');

    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const save: CurrentRunSave = {
      screen: 'shop',
      run,
      rewards: [],
      savedAt: '2026-06-10T00:00:00.000Z',
    };
    adapter.saveRun(save);
    expect(adapter.loadRun()?.run.shops[shop.nodeId]).toBeDefined();
  });

  it('persists ascension progress and starts with the victory-heal relic', () => {
    const storage = createMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    adapter.saveAscensionProgress({ unlockedLevel: 4 });
    expect(adapter.loadAscensionProgress().unlockedLevel).toBe(4);

    const run = {
      ...startRun('starter-relic'),
      deck: [{ definitionId: 'short-blade-advance', instanceId: 'starter-strike', upgraded: false }],
    };
    expect(run.relics).toContain('afterglow-charm');
    expect(relics.find((relic) => relic.id === 'afterglow-charm')?.starter).toBe(true);

    const started = startCombat({ ...run, character: { ...run.character, hp: 40 } }, {
      ...trainingEnemies[0],
      maxHp: 1,
    });
    const combat = playCard(started.combat, started.combat.hand[0].instanceId, started.combat.enemies[0].instanceId);
    expect(combat.phase).toBe('won');
    expect(combat.player.hp).toBe(43);
  });
});

function makeEnterable(run: RunState, node: MapNode): { run: RunState; node: MapNode } {
  const parentId = node.parentNodeIds[0];
  const map = run.map.map((candidate) => {
    if (candidate.id === node.id) {
      return { ...candidate, status: 'available' as const };
    }

    if (candidate.id === parentId) {
      return { ...candidate, status: 'completed' as const };
    }

    return candidate;
  });

  const nextRun = { ...run, map };
  expect(canEnterNode(nextRun.map, node.id)).toBe(true);
  return { run: nextRun, node: nextRun.map.find((candidate) => candidate.id === node.id)! };
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
