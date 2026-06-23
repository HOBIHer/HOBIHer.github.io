import { curseCards } from '../data/cards/curses';
import { rewardWarriorCards, warriorCardById } from '../data/cards/warrior';
import {
  actRecoveryEvents,
  minorEventDefinitions,
  neowCostChoices,
  neowPositiveChoices,
} from '../data/events/events';
import { potions } from '../data/potions/potions';
import { relics } from '../data/relics/relics';
import { normalizeSeed, randomInt } from '../rng';
import type {
  CardInstance,
  CardType,
  EventChoice,
  EventDefinition,
  EventEffect,
  EventState,
  MapNode,
  RelicId,
  RunState,
} from '../types';
import { createRewardCardInstance } from './deck';
import { markNodeCompleted } from './map';
import { createPotionInstance } from './potions';
import { pickWeightedRelics } from './rewards';
import { upgradeCardInstance } from './cardUpgrades';

export function createActStartEvent(run: RunState, act: number): EventState {
  if (act === 1) {
    const costChoice = pickChoices(neowCostChoices, `${run.seed}:act1:cost`, 1)[0];
    const exclusions = getNeowPositiveExclusions(costChoice?.id);
    const positives = neowPositiveChoices.filter(
      (choice) => !exclusions.has(choice.id) && !isBlockedChoice(choice),
    );
    const positiveChoices = pickChoices(positives, `${run.seed}:act1:positive:${costChoice?.id}`, 2);
    const choices = [...positiveChoices, costChoice].filter(Boolean).map((choice) =>
      evaluateChoiceAvailability(run, choice),
    );

    return {
      id: `${run.id}-act1-major`,
      eventId: 'v150-act1-opening',
      kind: 'major',
      seed: `${run.seed}:act1:major`,
      name: '潮始赠礼',
      lowProfileName: '起始事项',
      description: '第一幕开局固定大事件。从两个正面选项和一个代价选项中选择其一。',
      lowProfileDescription: '第一阶段起始流程。从两个收益项和一个代价项中确认其一。',
      choices,
      resultLog: [],
    };
  }

  const fallback = actRecoveryEvents.find((event) => event.id === `v150-act${act}-recovery`) ?? actRecoveryEvents[0];
  return {
    id: `${run.id}-act${act}-major`,
    eventId: fallback.id,
    kind: 'major',
    seed: `${run.seed}:act${act}:major`,
    name: fallback.name,
    lowProfileName: fallback.lowProfileName,
    description: fallback.description,
    lowProfileDescription: fallback.lowProfileDescription,
    choices: fallback.choices.map((choice) => evaluateChoiceAvailability(run, choice)),
    resultLog: [],
  };
}

export function enterEventNode(run: RunState, node: MapNode): RunState {
  const event = createMinorEventState(run, node);
  const runAtEvent: RunState = {
    ...run,
    currentScreen: 'event',
    currentNodeId: node.id,
    currentEvent: event,
    currentCombat: undefined,
  };

  return {
    ...runAtEvent,
    eventStartSnapshot: {
      id: `${run.id}-${node.id}-event-start`,
      eventSeed: event.seed,
      run: stripTransientSnapshots(runAtEvent),
    },
  };
}

export function resolveEventChoice(run: RunState, choiceId: string): RunState {
  const event = run.currentEvent;
  if (!event) {
    return run;
  }

  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) {
    return run;
  }

  const availableChoice = evaluateChoiceAvailability(run, choice);
  if (availableChoice.status === 'locked' || availableChoice.status === 'blocked') {
    return {
      ...run,
      currentEvent: {
        ...event,
        choices: event.choices.map((candidate) =>
          candidate.id === choice.id ? availableChoice : evaluateChoiceAvailability(run, candidate),
        ),
        resultLog: [availableChoice.lockedReason ?? '该选项当前不可用。'],
      },
      runLog: [...run.runLog, `${event.name}: ${availableChoice.lockedReason ?? '选项不可用'}`],
    };
  }

  let nextRun = run;
  const resultLog: string[] = [];
  for (const effect of choice.effects) {
    const result = applyEventEffect(nextRun, effect, event.seed, resultLog.length);
    nextRun = result.run;
    resultLog.push(...result.log);
  }

  const seenEventIds = appendUnique(nextRun.seenEventIds, event.eventId);
  const runLog = [...nextRun.runLog, `${event.name}: ${choice.label}`, ...resultLog];

  if (event.kind === 'minor' && event.nodeId) {
    const map = markNodeCompleted(nextRun.map, event.nodeId);
    return {
      ...nextRun,
      map,
      currentScreen: 'map',
      currentNodeId: undefined,
      currentEvent: undefined,
      eventStartSnapshot: undefined,
      completedNodeIds: appendUnique(nextRun.completedNodeIds, event.nodeId),
      seenEventIds,
      runLog,
    };
  }

  return {
    ...nextRun,
    currentScreen: 'map',
    currentEvent: undefined,
    eventStartSnapshot: undefined,
    seenEventIds,
    runLog,
  };
}

export function restartEventFromSnapshot(run: RunState): RunState {
  const snapshot = run.eventStartSnapshot;
  return snapshot ? snapshot.run : run;
}

export function createMinorEventState(run: RunState, node: MapNode): EventState {
  const available = minorEventDefinitions.filter(
    (event) => !run.seenEventIds.includes(event.id) && hasAvailableChoice(run, event),
  );
  const allCompletable = minorEventDefinitions.filter((event) => hasAvailableChoice(run, event));
  const pool = available.length > 0 ? available : allCompletable;

  if (pool.length === 0) {
    return createFallbackMinorEventState(run, node);
  }

  const index = randomInt(normalizeSeed(`${run.seed}:${node.id}:event:${run.act}`), pool.length);
  const definition = pool[index.value];

  return buildMinorEventState(run, node, definition, index.seed);
}

function buildMinorEventState(
  run: RunState,
  node: MapNode,
  definition: EventDefinition,
  seed: number,
): EventState {
  return {
    id: `${run.id}-${node.id}-event`,
    eventId: definition.id,
    kind: 'minor',
    nodeId: node.id,
    seed: `${run.seed}:${node.id}:event:${seed}`,
    name: definition.name,
    lowProfileName: definition.lowProfileName,
    description: definition.description,
    lowProfileDescription: definition.lowProfileDescription,
    choices: definition.choices.map((choice) => evaluateChoiceAvailability(run, choice)),
    resultLog: [],
  };
}

function createFallbackMinorEventState(run: RunState, node: MapNode): EventState {
  return {
    id: `${run.id}-${node.id}-event`,
    eventId: 'v150-quiet-passage',
    kind: 'minor',
    nodeId: node.id,
    seed: `${run.seed}:${node.id}:event:fallback`,
    name: 'Quiet Passage',
    lowProfileName: 'Process Step',
    description: 'The event pool has no currently available choices. Continue forward.',
    lowProfileDescription: 'No executable branch is available. Continue the process.',
    choices: [
      {
        id: 'continue',
        label: 'Continue',
        lowProfileLabel: 'Continue',
        description: 'Leave without changes.',
        lowProfileDescription: 'Proceed without changing resources.',
        effects: [],
        status: 'available',
      },
    ],
    resultLog: [],
  };
}

function hasAvailableChoice(run: RunState, definition: EventDefinition): boolean {
  return definition.choices.some((choice) => evaluateChoiceAvailability(run, choice).status === 'available');
}

function applyEventEffect(
  run: RunState,
  effect: EventEffect,
  seed: string,
  index: number,
): { run: RunState; log: string[] } {
  if (effect.type === 'blocked') {
    return { run, log: [effect.reason] };
  }

  if (effect.type === 'gainGold') {
    return {
      run: { ...run, character: { ...run.character, gold: run.character.gold + effect.amount } },
      log: [`获得 ${effect.amount} 金币。`],
    };
  }

  if (effect.type === 'loseGold') {
    const amount = effect.amount === 'all' ? run.character.gold : Math.min(run.character.gold, effect.amount);
    return {
      run: { ...run, character: { ...run.character, gold: run.character.gold - amount } },
      log: [`失去 ${amount} 金币。`],
    };
  }

  if (effect.type === 'loseHp') {
    const hpLoss = Math.min(run.character.hp, Math.max(0, effect.amount));
    return {
      run: { ...run, character: { ...run.character, hp: run.character.hp - hpLoss } },
      log: [`失去 ${hpLoss} 点生命。`],
    };
  }

  if (effect.type === 'healToAtLeastPercent') {
    const targetHp = Math.min(run.character.maxHp, Math.ceil(run.character.maxHp * effect.percent));
    const nextHp = Math.max(run.character.hp, targetHp);
    return {
      run: { ...run, character: { ...run.character, hp: nextHp } },
      log: [`生命恢复到 ${nextHp}/${run.character.maxHp}。`],
    };
  }

  if (effect.type === 'gainMaxHp') {
    return {
      run: {
        ...run,
        character: {
          ...run.character,
          maxHp: run.character.maxHp + effect.amount,
          hp: run.character.hp + (effect.healSameAmount ? effect.amount : 0),
        },
      },
      log: [`最大生命提高 ${effect.amount}。`],
    };
  }

  if (effect.type === 'gainPotionSlot') {
    return { run: { ...run, potionSlots: run.potionSlots + effect.amount }, log: [`药水栏位 +${effect.amount}。`] };
  }

  if (effect.type === 'addRandomPotion') {
    let nextRun = run;
    let rngSeed = normalizeSeed(`${seed}:potion:${index}`);
    let added = 0;
    const pool = potions.filter(
      (potion) =>
        potion.rarity !== 'event' &&
        potion.rarity !== 'token' &&
        (!effect.rarity || potion.rarity === effect.rarity),
    );

    for (let count = 0; count < effect.amount && nextRun.potions.length < nextRun.potionSlots && pool.length > 0; count += 1) {
      const random = randomInt(rngSeed, pool.length);
      rngSeed = random.seed;
      const potion = pool[random.value];
      nextRun = {
        ...nextRun,
        potions: [...nextRun.potions, createPotionInstance(potion.id, `${nextRun.id}-event-potion-${rngSeed}-${count}`)],
      };
      added += 1;
    }

    return { run: { ...nextRun, rngSeed }, log: [`获得 ${added} 瓶药水。`] };
  }

  if (effect.type === 'loseRandomPotion') {
    return removeRandomItems(run, 'potion', effect.amount, seed, index);
  }

  if (effect.type === 'addRandomRelic') {
    let nextRun = run;
    let rngSeed = normalizeSeed(`${seed}:relic:${index}`);
    let added = 0;
    for (let count = 0; count < effect.amount; count += 1) {
      const candidates = effect.rarity
        ? relics.filter(
            (relic) =>
              !relic.starter &&
              relic.rarity === effect.rarity &&
              !nextRun.relics.includes(relic.id),
          )
        : undefined;
      const picked = candidates
        ? pickFrom(candidates, rngSeed)
        : pickWeightedRelics(rngSeed, nextRun.relics, 1);
      const relic = 'items' in picked ? picked.items[0] : picked.relics[0];
      rngSeed = picked.rngSeed;
      if (!relic) {
        break;
      }
      nextRun = { ...nextRun, relics: [...nextRun.relics, relic.id] };
      added += 1;
    }
    return { run: { ...nextRun, rngSeed }, log: [`获得 ${added} 个遗物。`] };
  }

  if (effect.type === 'removeRandomRelic') {
    return removeRandomItems(run, 'relic', effect.amount, seed, index);
  }

  if (effect.type === 'addCard') {
    return {
      run: {
        ...run,
        deck: [...run.deck, createEventCard(effect.cardId, `${run.id}-event-card-${run.deck.length}`, effect.upgraded)],
      },
      log: [`加入 ${warriorCardById[effect.cardId]?.name ?? effect.cardId}。`],
    };
  }

  if (effect.type === 'addRandomCard') {
    let nextRun = run;
    let rngSeed = normalizeSeed(`${seed}:card:${index}`);
    let added = 0;
    const pool = rewardWarriorCards.filter(
      (card) =>
        (!effect.rarity || card.rarity === effect.rarity) &&
        (!effect.cardType || card.type === effect.cardType),
    );
    for (let count = 0; count < effect.amount && pool.length > 0; count += 1) {
      const random = randomInt(rngSeed, pool.length);
      rngSeed = random.seed;
      const card = pool[random.value];
      nextRun = {
        ...nextRun,
        deck: [...nextRun.deck, createEventCard(card.id, `${nextRun.id}-event-card-${rngSeed}-${count}`, effect.upgraded)],
      };
      added += 1;
    }
    return { run: { ...nextRun, rngSeed }, log: [`加入 ${added} 张牌。`] };
  }

  if (effect.type === 'addCurse') {
    return {
      run: {
        ...run,
        deck: [...run.deck, createEventCard(effect.cardId, `${run.id}-curse-${run.deck.length}`)],
      },
      log: [`加入 1 张诅咒。`],
    };
  }

  if (effect.type === 'addRandomCurse') {
    let nextRun = run;
    let rngSeed = normalizeSeed(`${seed}:curse:${index}`);
    const pool = curseCards.filter((curse) => curse.id !== 'curse-ascenders-bane');
    for (let count = 0; count < effect.amount && pool.length > 0; count += 1) {
      const random = randomInt(rngSeed, pool.length);
      rngSeed = random.seed;
      nextRun = {
        ...nextRun,
        deck: [...nextRun.deck, createEventCard(pool[random.value].id, `${nextRun.id}-curse-${rngSeed}-${count}`)],
      };
    }
    return { run: { ...nextRun, rngSeed }, log: [`加入 ${effect.amount} 张随机诅咒。`] };
  }

  if (effect.type === 'upgradeRandomCards') {
    return mutateRandomCards(run, effect.amount, seed, index, effect.nameIncludes, (card) =>
      card.upgraded ? card : upgradeCardInstance(card),
      '升级',
    );
  }

  if (effect.type === 'removeRandomCards') {
    const selected = selectCards(run, effect.amount, seed, index);
    const selectedIds = new Set(selected.cards.map((card) => card.instanceId));
    return {
      run: { ...run, rngSeed: selected.rngSeed, deck: run.deck.filter((card) => !selectedIds.has(card.instanceId)) },
      log: [`移除 ${selected.cards.length} 张牌。`],
    };
  }

  if (effect.type === 'transformRandomCards') {
    const selected = selectCards(run, effect.amount, seed, index, effect.nameIncludes);
    const selectedIds = new Set(selected.cards.map((card) => card.instanceId));
    let rngSeed = selected.rngSeed;
    const deck = run.deck.map((card) => {
      if (!selectedIds.has(card.instanceId) || rewardWarriorCards.length === 0) {
        return card;
      }
      const random = randomInt(rngSeed, rewardWarriorCards.length);
      rngSeed = random.seed;
      return createEventCard(rewardWarriorCards[random.value].id, `${card.instanceId}-transformed`, card.upgraded);
    });
    return { run: { ...run, rngSeed, deck }, log: [`转化 ${selected.cards.length} 张牌。`] };
  }

  if (effect.type === 'downgradeRandomCards') {
    return mutateRandomCards(run, effect.amount, seed, index, undefined, (card) => ({ ...card, upgraded: false }), '降级', true);
  }

  return { run, log: [] };
}

function evaluateChoiceAvailability(run: RunState, choice: EventChoice): EventChoice {
  const blockedEffect = choice.effects.find((effect) => effect.type === 'blocked');
  if (blockedEffect?.type === 'blocked') {
    return { ...choice, status: 'blocked', lockedReason: blockedEffect.reason };
  }

  for (const effect of choice.effects) {
    if (effect.type === 'loseGold' && typeof effect.amount === 'number' && run.character.gold < effect.amount) {
      return { ...choice, status: 'locked', lockedReason: '金币不足。' };
    }
    if (effect.type === 'loseRandomPotion' && run.potions.length < effect.amount) {
      return { ...choice, status: 'locked', lockedReason: '没有足够药水。' };
    }
    if (effect.type === 'removeRandomRelic' && removableRelics(run).length < effect.amount) {
      return { ...choice, status: 'locked', lockedReason: '没有可交换遗物。' };
    }
    if (effect.type === 'removeRandomCards' && removableCards(run).length < effect.amount) {
      return { ...choice, status: 'locked', lockedReason: '没有可移除牌。' };
    }
  }

  return { ...choice, status: 'available', lockedReason: undefined };
}

function mutateRandomCards(
  run: RunState,
  amount: number,
  seed: string,
  index: number,
  nameIncludes: string | undefined,
  mutate: (card: CardInstance) => CardInstance,
  label: string,
  requireUpgraded = false,
): { run: RunState; log: string[] } {
  const selected = selectCards(run, amount, seed, index, nameIncludes, requireUpgraded);
  const selectedIds = new Set(selected.cards.map((card) => card.instanceId));
  return {
    run: {
      ...run,
      rngSeed: selected.rngSeed,
      deck: run.deck.map((card) => (selectedIds.has(card.instanceId) ? mutate(card) : card)),
    },
    log: [`${label} ${selected.cards.length} 张牌。`],
  };
}

function selectCards(
  run: RunState,
  amount: number,
  seed: string,
  index: number,
  nameIncludes?: string,
  requireUpgraded = false,
): { cards: CardInstance[]; rngSeed: number } {
  let rngSeed = normalizeSeed(`${seed}:deck:${index}`);
  const candidates = removableCards(run).filter((card) => {
    const definition = warriorCardById[card.definitionId];
    const matchesName =
      !nameIncludes ||
      definition.name.includes(nameIncludes) ||
      definition.lowProfileName.includes(nameIncludes) ||
      definition.id.includes(nameIncludes) ||
      (nameIncludes === 'Strike' && isStrikeLike(definition.id)) ||
      (nameIncludes === 'Defend' && isDefendLike(definition.id));
    return matchesName && (!requireUpgraded || card.upgraded);
  });
  const selected: CardInstance[] = [];
  const available = [...candidates];
  while (available.length > 0 && selected.length < amount) {
    const random = randomInt(rngSeed, available.length);
    rngSeed = random.seed;
    const [card] = available.splice(random.value, 1);
    selected.push(card);
  }
  return { cards: selected, rngSeed };
}

function removeRandomItems(
  run: RunState,
  kind: 'potion' | 'relic',
  amount: number,
  seed: string,
  index: number,
): { run: RunState; log: string[] } {
  let rngSeed = normalizeSeed(`${seed}:${kind}:${index}`);
  if (kind === 'potion') {
    const potionsLeft = [...run.potions];
    let removed = 0;
    for (let count = 0; count < amount && potionsLeft.length > 0; count += 1) {
      const random = randomInt(rngSeed, potionsLeft.length);
      rngSeed = random.seed;
      potionsLeft.splice(random.value, 1);
      removed += 1;
    }
    return { run: { ...run, rngSeed, potions: potionsLeft }, log: [`失去 ${removed} 瓶药水。`] };
  }

  const available = removableRelics(run);
  const relicsLeft = [...run.relics];
  let removed = 0;
  for (let count = 0; count < amount && available.length > 0; count += 1) {
    const random = randomInt(rngSeed, available.length);
    rngSeed = random.seed;
    const [relic] = available.splice(random.value, 1);
    const relicIndex = relicsLeft.indexOf(relic);
    if (relicIndex >= 0) {
      relicsLeft.splice(relicIndex, 1);
      removed += 1;
    }
  }
  return { run: { ...run, rngSeed, relics: relicsLeft }, log: [`失去 ${removed} 个遗物。`] };
}

function removableCards(run: RunState): CardInstance[] {
  return run.deck.filter((card) => {
    const definition = warriorCardById[card.definitionId];
    return definition && !definition.unremovable && !definition.keywords?.includes('eternal');
  });
}

function removableRelics(run: RunState): RelicId[] {
  const starterIds = new Set(relics.filter((relic) => relic.starter).map((relic) => relic.id));
  return run.relics.filter((relicId) => !starterIds.has(relicId));
}

function createEventCard(definitionId: string, prefix: string, upgraded = false): CardInstance {
  const definition = warriorCardById[definitionId];
  return {
    ...createRewardCardInstance(definitionId, prefix),
    upgraded,
    remainingCombats: definition?.removeAfterCombats,
  };
}

function pickChoices<T>(choices: T[], seed: string, count: number): T[] {
  const picked = pickFrom(choices, normalizeSeed(seed), count);
  return picked.items;
}

function pickFrom<T>(items: T[], seed: number, count = 1): { items: T[]; rngSeed: number } {
  const available = [...items];
  const picked: T[] = [];
  let rngSeed = seed;

  while (available.length > 0 && picked.length < count) {
    const random = randomInt(rngSeed, available.length);
    rngSeed = random.seed;
    const [item] = available.splice(random.value, 1);
    picked.push(item);
  }

  return { items: picked, rngSeed };
}

function getNeowPositiveExclusions(costChoiceId?: string): Set<string> {
  if (costChoiceId === 'cursed-pearl') {
    return new Set(['golden-pearl']);
  }
  if (costChoiceId === 'large-capsule') {
    return new Set(['small-capsule']);
  }
  if (costChoiceId === 'precarious-shears') {
    return new Set(['precise-scissors']);
  }
  if (costChoiceId === 'leafy-poultice') {
    return new Set(['new-leaf']);
  }
  if (costChoiceId === 'hefty-tablet') {
    return new Set(['arcane-scroll']);
  }
  return new Set();
}

function isBlockedChoice(choice: EventChoice): boolean {
  return choice.effects.some((effect) => effect.type === 'blocked');
}

function appendUnique<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values : [...values, value];
}

function stripTransientSnapshots(run: RunState): RunState {
  return {
    ...run,
    combatStartSnapshot: undefined,
    eventStartSnapshot: undefined,
    shopStartSnapshot: undefined,
  };
}

function isStrikeLike(cardId: string): boolean {
  return cardId === 'short-blade-advance' || cardId.includes('strike') || cardId.includes('plain-strike');
}

function isDefendLike(cardId: string): boolean {
  return cardId === 'guarded-stance' || cardId.includes('guard') || cardId.includes('defend');
}
