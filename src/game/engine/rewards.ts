import { rewardWarriorCards } from '../data/cards/warrior';
import { relics } from '../data/relics/relics';
import { normalizeSeed, randomInt } from '../rng';
import type {
  CardDefinition,
  CardRarity,
  MapNode,
  RelicDefinition,
  RelicId,
  RelicRarity,
  RewardBundle,
  RewardOption,
  RunState,
} from '../types';

type RewardSource = 'combat' | 'elite';

export const CARD_REWARD_RARITY_WEIGHTS: Record<RewardSource, Record<Exclude<CardRarity, 'starter'>, number>> = {
  combat: {
    common: 70,
    uncommon: 25,
    rare: 5,
  },
  elite: {
    common: 55,
    uncommon: 35,
    rare: 10,
  },
};

export const RELIC_REWARD_RARITY_WEIGHTS: Record<RelicRarity, number> = {
  common: 65,
  uncommon: 28,
  rare: 7,
};

export function generateCardRewards(
  run: RunState,
  count = 3,
): { rewards: RewardOption[]; rngSeed: number } {
  const result = pickWeightedCards(run.rngSeed, 'combat', count);

  return {
    rewards: result.cards.map((card) => ({
      id: `reward-${run.combatsWon}-${card.id}`,
      type: 'card',
      cardId: card.id,
    })),
    rngSeed: result.rngSeed,
  };
}

export function generateNodeReward(run: RunState, node: MapNode): RewardBundle {
  const seedBase = `${run.seed}:${run.rngSeed}:${node.id}:reward:${run.deck.length}:${run.relics.join('|')}`;
  let rngSeed = normalizeSeed(seedBase);

  if (node.type === 'boss') {
    return {
      id: `reward-${node.id}`,
      sourceNodeId: node.id,
      cardChoices: [],
      gold: 0,
      relicChoices: [],
      claimed: false,
    };
  }

  const source: RewardSource = node.type === 'elite' ? 'elite' : 'combat';
  const cardResult = pickWeightedCards(rngSeed, source, 3);
  rngSeed = cardResult.rngSeed;

  const goldRange = node.type === 'elite' ? { min: 20, max: 30 } : { min: 10, max: 15 };
  const goldRandom = randomInt(rngSeed, goldRange.max - goldRange.min + 1);
  rngSeed = goldRandom.seed;

  const relicResult =
    node.type === 'elite'
      ? pickWeightedRelics(rngSeed, run.relics, 1)
      : { relics: [] as RelicDefinition[], rngSeed };

  return {
    id: `reward-${node.id}`,
    sourceNodeId: node.id,
    cardChoices: cardResult.cards.map((card) => card.id),
    gold: goldRange.min + goldRandom.value,
    relicChoices: relicResult.relics.map((relic) => relic.id),
    claimed: false,
  };
}

export function pickWeightedCards(
  seed: number,
  source: RewardSource,
  count: number,
): { cards: CardDefinition[]; rngSeed: number } {
  let rngSeed = seed;
  const available = [...rewardWarriorCards];
  const cards: CardDefinition[] = [];

  while (available.length > 0 && cards.length < count) {
    const rarities = getAvailableCardRarities(available);
    const rarityResult = pickWeightedRarity(rngSeed, CARD_REWARD_RARITY_WEIGHTS[source], rarities);
    rngSeed = rarityResult.rngSeed;

    const candidates = available.filter((card) => card.rarity === rarityResult.rarity);
    const indexResult = randomInt(rngSeed, candidates.length);
    rngSeed = indexResult.seed;

    const picked = candidates[indexResult.value];
    cards.push(picked);
    available.splice(
      available.findIndex((card) => card.id === picked.id),
      1,
    );
  }

  return { cards, rngSeed };
}

export function pickWeightedRelics(
  seed: number,
  ownedRelics: RelicId[],
  count: number,
): { relics: RelicDefinition[]; rngSeed: number } {
  let rngSeed = seed;
  const owned = new Set(ownedRelics);
  const available = relics.filter((relic) => !owned.has(relic.id));
  const pickedRelics: RelicDefinition[] = [];

  while (available.length > 0 && pickedRelics.length < count) {
    const rarities = getAvailableRelicRarities(available);
    const rarityResult = pickWeightedRarity(rngSeed, RELIC_REWARD_RARITY_WEIGHTS, rarities);
    rngSeed = rarityResult.rngSeed;

    const candidates = available.filter((relic) => relic.rarity === rarityResult.rarity);
    const indexResult = randomInt(rngSeed, candidates.length);
    rngSeed = indexResult.seed;

    const picked = candidates[indexResult.value];
    pickedRelics.push(picked);
    available.splice(
      available.findIndex((relic) => relic.id === picked.id),
      1,
    );
  }

  return { relics: pickedRelics, rngSeed };
}

function getAvailableCardRarities(cards: CardDefinition[]): Exclude<CardRarity, 'starter'>[] {
  return ['common', 'uncommon', 'rare'].filter((rarity) =>
    cards.some((card) => card.rarity === rarity),
  ) as Exclude<CardRarity, 'starter'>[];
}

function getAvailableRelicRarities(availableRelics: RelicDefinition[]): RelicRarity[] {
  return ['common', 'uncommon', 'rare'].filter((rarity) =>
    availableRelics.some((relic) => relic.rarity === rarity),
  ) as RelicRarity[];
}

function pickWeightedRarity<T extends string>(
  seed: number,
  weights: Record<T, number>,
  availableRarities: T[],
): { rarity: T; rngSeed: number } {
  const totalWeight = availableRarities.reduce(
    (total, rarity) => total + Math.max(0, weights[rarity] ?? 0),
    0,
  );

  if (totalWeight <= 0) {
    return { rarity: availableRarities[0], rngSeed: seed };
  }

  const random = randomInt(seed, totalWeight);
  let cursor = random.value;

  for (const rarity of availableRarities) {
    cursor -= Math.max(0, weights[rarity] ?? 0);
    if (cursor < 0) {
      return { rarity, rngSeed: random.seed };
    }
  }

  return { rarity: availableRarities[availableRarities.length - 1], rngSeed: random.seed };
}
