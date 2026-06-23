import { rewardWarriorCards } from '../data/cards/warrior';
import { potions } from '../data/potions/potions';
import { relics } from '../data/relics/relics';
import { normalizeSeed, randomInt } from '../rng';
import type { MapNode, RelicId, RunState, ShopItem, ShopState } from '../types';
import { getShopRemoveCardPrice } from './ascension';
import { createRewardCardInstance } from './deck';
import { markNodeCompleted } from './map';
import { createPotionInstance } from './potions';

export function createShopState(run: RunState, node: MapNode): ShopState {
  const existing = run.shops[node.id];
  if (existing) {
    return existing;
  }

  let rngSeed = normalizeSeed(`${run.seed}:${node.id}:shop:${run.ascensionLevel}`);
  const items: ShopItem[] = [];

  const cardPicks = pickUnique(rewardWarriorCards, rngSeed, 3);
  rngSeed = cardPicks.rngSeed;
  for (const card of cardPicks.items) {
    items.push({
      id: `${node.id}-card-${card.id}`,
      type: 'card',
      refId: card.id,
      price: getCardPrice(card.rarity),
      sold: false,
    });
  }

  const availableRelics = relics.filter((relic) => !relic.starter && !run.relics.includes(relic.id));
  const relicPicks = pickUnique(availableRelics, rngSeed, 2);
  rngSeed = relicPicks.rngSeed;
  for (const relic of relicPicks.items) {
    items.push({
      id: `${node.id}-relic-${relic.id}`,
      type: 'relic',
      refId: relic.id,
      price: getRelicPrice(relic.rarity),
      sold: false,
    });
  }

  const potionPool = potions.filter((potion) => potion.rarity !== 'event' && potion.rarity !== 'token');
  const potionPicks = pickUnique(potionPool, rngSeed, 3);
  for (const potion of potionPicks.items) {
    items.push({
      id: `${node.id}-potion-${potion.id}`,
      type: 'potion',
      refId: potion.id,
      price: getPotionPrice(potion.rarity),
      sold: false,
    });
  }

  return {
    nodeId: node.id,
    items,
    removeCardPrice: getShopRemoveCardPrice(run.ascensionLevel),
  };
}

export function enterShopNode(run: RunState, node: MapNode): RunState {
  const shop = createShopState(run, node);
  const runAtShop: RunState = {
    ...run,
    currentScreen: 'shop',
    currentNodeId: node.id,
    currentShop: shop,
    shops: {
      ...run.shops,
      [node.id]: shop,
    },
    currentCombat: undefined,
  };
  return {
    ...runAtShop,
    shopStartSnapshot: {
      id: `${run.id}-${node.id}-shop-start`,
      nodeId: node.id,
      shopSeed: `${run.seed}:${node.id}:shop:${run.ascensionLevel}`,
      run: {
        ...runAtShop,
        combatStartSnapshot: undefined,
        eventStartSnapshot: undefined,
        shopStartSnapshot: undefined,
      },
    },
  };
}

export function buyShopItem(run: RunState, itemId: string): RunState {
  const shop = run.currentShop;
  if (!shop) {
    return run;
  }

  const item = shop.items.find((candidate) => candidate.id === itemId);
  if (!item || item.sold || run.character.gold < item.price || !item.refId) {
    return run;
  }

  if (item.type === 'potion' && run.potions.length >= run.potionSlots) {
    return {
      ...run,
      runLog: [...run.runLog, '药水栏已满，无法购买。'],
    };
  }

  if (item.type === 'relic' && run.relics.includes(item.refId as RelicId)) {
    return run;
  }

  const soldShop = {
    ...shop,
    items: shop.items.map((candidate) =>
      candidate.id === item.id ? { ...candidate, sold: true } : candidate,
    ),
  };

  const paidRun: RunState = {
    ...run,
    character: {
      ...run.character,
      gold: run.character.gold - item.price,
    },
    currentShop: soldShop,
    shops: {
      ...run.shops,
      [shop.nodeId]: soldShop,
    },
  };

  if (item.type === 'card') {
    return {
      ...paidRun,
      deck: [...paidRun.deck, createRewardCardInstance(item.refId, `${run.id}-shop-${run.deck.length}`)],
    };
  }

  if (item.type === 'relic') {
    return {
      ...paidRun,
      relics: [...paidRun.relics, item.refId],
    };
  }

  if (item.type === 'potion') {
    return {
      ...paidRun,
      potions: [
        ...paidRun.potions,
        createPotionInstance(item.refId, `${run.id}-shop-potion-${run.potions.length}`),
      ],
    };
  }

  return paidRun;
}

export function leaveShopNode(run: RunState): RunState {
  const shop = run.currentShop;
  if (!shop) {
    return run;
  }

  const map = markNodeCompleted(run.map, shop.nodeId);
  return {
    ...run,
    map,
    currentNodeId: undefined,
    completedNodeIds: run.completedNodeIds.includes(shop.nodeId)
      ? run.completedNodeIds
      : [...run.completedNodeIds, shop.nodeId],
    currentShop: undefined,
    shopStartSnapshot: undefined,
    currentScreen: 'map',
  };
}

function pickUnique<T>(items: T[], seed: number, count: number): { items: T[]; rngSeed: number } {
  let rngSeed = seed;
  const available = [...items];
  const picked: T[] = [];

  while (available.length > 0 && picked.length < count) {
    const random = randomInt(rngSeed, available.length);
    rngSeed = random.seed;
    const [item] = available.splice(random.value, 1);
    picked.push(item);
  }

  return { items: picked, rngSeed };
}

function getCardPrice(rarity: string): number {
  if (rarity === 'rare' || rarity === 'ancient') {
    return 95;
  }

  if (rarity === 'uncommon') {
    return 70;
  }

  return 45;
}

function getRelicPrice(rarity: string): number {
  if (rarity === 'rare') {
    return 180;
  }

  if (rarity === 'uncommon') {
    return 145;
  }

  return 120;
}

function getPotionPrice(rarity: string): number {
  if (rarity === 'rare') {
    return 70;
  }

  if (rarity === 'uncommon') {
    return 55;
  }

  return 35;
}
