import { normalTrainingEnemies, trainingEnemies } from '../data/enemies/training';
import { ironOathStarterLoadout } from '../data/starterDecks';
import { normalizeSeed, shuffle } from '../rng';
import type {
  AscensionLevel,
  CardDefinition,
  CardType,
  CombatPhase,
  CombatState,
  CombatTurnStats,
  CombatantState,
  EnemyCombatantState,
  EnemyDefinition,
  RelicId,
  RunState,
  StatusId,
} from '../types';
import { getAscensionEnemyMaxHp } from './ascension';
import { createCardInstances, createDeckCardInstances, drawCards, type DrawCardsOptions } from './deck';
import {
  applyAfterCardPlayedPowers,
  applyDrawnCardTriggers,
  applyPlayedCardPostEffects,
  applyTurnEndHandRules,
  applyTurnEndCardPowers,
  applyTurnStartCardPowers,
  applyTurnEndStatusEffects,
  getCardDefinitionForInstance,
  getCardPlayBlockReason,
  getCardPlayCost,
  getCardXValue,
  getStatus,
  prepareForTurnStart,
  recordExhaustedCards,
  resolveCardEffects,
  resolveEnemyEffect,
} from './effects';
import { resolveRelicTriggers } from './relics';

export const STARTING_MAX_HP = 72;
export const STARTING_ENERGY = 3;
export const STARTING_HAND_SIZE = 5;
export const STARTING_RELICS: RelicId[] = [...ironOathStarterLoadout.relics];

export function startRun(
  seed: number | string = Date.now(),
  relics: RelicId[] | undefined = STARTING_RELICS,
  ascensionLevel: AscensionLevel = 0,
): RunState {
  const rngSeed = normalizeSeed(seed);
  const runStartedAt = new Date().toISOString();
  return {
    id: `run-${rngSeed}`,
    seed: String(seed),
    rngSeed,
    status: 'active',
    currentScreen: 'combat',
    character: {
      id: 'iron-oath',
      name: '铁誓者',
      hp: STARTING_MAX_HP,
      maxHp: STARTING_MAX_HP,
      gold: 0,
    },
    deck: createDeckCardInstances(ironOathStarterLoadout.deck, `deck-${rngSeed}`),
    relics: uniqueRelics(relics ?? STARTING_RELICS),
    potions: [],
    potionSlots: 3,
    combatsWon: 0,
    map: [],
    completedNodeIds: [],
    act: 1,
    floor: 1,
    runStartedAt,
    ascensionLevel,
    shops: {},
    seenEventIds: [],
    runLog: [],
  };
}

export function getEnemyForRun(run: RunState): EnemyDefinition {
  return normalTrainingEnemies[run.combatsWon % normalTrainingEnemies.length];
}

export function startCombat(
  run: RunState,
  enemyDefinition: EnemyDefinition | EnemyDefinition[] = getEnemyForRun(run),
): { run: RunState; combat: CombatState } {
  const cardInstances = createCardInstances(run.deck, `combat-${run.combatsWon}`);
  const shuffled = shuffle(cardInstances, run.rngSeed);
  const enemyDefinitions = Array.isArray(enemyDefinition) ? enemyDefinition : [enemyDefinition];
  const enemies = enemyDefinitions.map((definition, index) =>
    createEnemyCombatant(definition, index, run.ascensionLevel),
  );
  const encounterName = enemies.map((enemy) => enemy.name).join('、');
  const baseCombat: CombatState = {
    id: `${run.id}-combat-${run.combatsWon + 1}`,
    rngSeed: shuffled.seed,
    ascensionLevel: run.ascensionLevel,
    turn: 1,
    phase: 'player',
    player: {
      name: run.character.name,
      hp: run.character.hp,
      maxHp: run.character.maxHp,
      block: 0,
      statuses: {},
    },
    enemies,
    drawPile: shuffled.items,
    hand: [],
    discardPile: [],
    exhaustPile: [],
    energy: STARTING_ENERGY,
    maxEnergy: STARTING_ENERGY,
    relics: [...run.relics],
    turnStats: createTurnStats(),
    combatStats: {
      hpLossEvents: 0,
      goldLost: 0,
    },
    log: [`遭遇 ${encounterName}。`],
  };

  let combat = resolveRelicTriggers(baseCombat, 'onCombatStart');
  combat = pullInnateCardsToOpeningHand(combat);
  combat = drawWithRelicShuffle(combat, Math.max(0, STARTING_HAND_SIZE - combat.hand.length));
  combat = resolveRelicTriggers(combat, 'onTurnStart');

  return {
    run: {
      ...run,
      rngSeed: combat.rngSeed,
      currentScreen: 'combat',
      currentCombat: combat,
    },
    combat,
  };
}

export function playCard(
  combat: CombatState,
  cardInstanceId: string,
  targetEnemyId?: string,
): CombatState {
  if (combat.phase !== 'player') {
    return appendLog(combat, '现在不能出牌。');
  }

  const cardIndex = combat.hand.findIndex((card) => card.instanceId === cardInstanceId);
  if (cardIndex < 0) {
    return appendLog(combat, '手牌中没有这张牌。');
  }

  const cardInstance = combat.hand[cardIndex];
  const card = getCardDefinitionForInstance(cardInstance);
  const cost = getCardPlayCost(combat, cardInstance, card);
  const xValue = getCardXValue(combat, cardInstance, card);
  const blockedReason = getCardPlayBlockReason(combat, card);

  if (card.target === 'enemy' && !isPlayableEnemyTarget(combat, targetEnemyId)) {
    return appendLog(combat, '目标已经无法选择。');
  }

  if (blockedReason) {
    return appendLog(combat, blockedReason);
  }

  if (combat.energy < cost) {
    return appendLog(combat, `能量不足，无法使用 ${card.name}。`);
  }

  const aliveBefore = getAliveEnemyIds(combat);
  const hand = combat.hand.filter((cardInHand) => cardInHand.instanceId !== cardInstanceId);
  let nextCombat: CombatState = {
    ...combat,
    hand,
    energy: combat.energy - cost,
    log: [...combat.log, `使用 ${card.name}。`],
  };

  const drawOptions = createDrawOptions();
  nextCombat = resolveCardEffects(nextCombat, card, targetEnemyId, drawOptions, {
    playedCard: cardInstance,
    xValue,
  });

  const postEffects = applyPlayedCardPostEffects(nextCombat, card, cardInstance, drawOptions);
  nextCombat = postEffects.combat;
  const resolvedPlayedCard = postEffects.playedCard;

  const shouldExhaust =
    card.type === 'power' ||
    card.keywords?.includes('exhaust') ||
    Boolean(resolvedPlayedCard.exhaustOnPlay) ||
    (card.type === 'skill' && getStatus(nextCombat.player, 'skillZeroExhaust') > 0) ||
    card.effects.some((effect) => effect.type === 'exhaustSelf');
  nextCombat = {
    ...nextCombat,
    discardPile: shouldExhaust ? nextCombat.discardPile : [...nextCombat.discardPile, resolvedPlayedCard],
    exhaustPile: shouldExhaust ? [...nextCombat.exhaustPile, resolvedPlayedCard] : nextCombat.exhaustPile,
  };

  if (shouldExhaust) {
    nextCombat = recordExhaustedCards(nextCombat, [resolvedPlayedCard], drawOptions);
  }

  nextCombat = recordCardPlayed(nextCombat, card.type);
  nextCombat = applyAfterCardPlayedPowers(nextCombat, card, resolvedPlayedCard, targetEnemyId, drawOptions);
  nextCombat = resolveRelicTriggers(nextCombat, 'onCardPlayed', { card });
  nextCombat = resolveCardTypeRelicTrigger(nextCombat, card);
  nextCombat = triggerEnemyKilled(nextCombat, aliveBefore);

  return checkCombatEnd(nextCombat);
}

function createDrawOptions(): DrawCardsOptions {
  return {
    onShuffle: (shuffledCombat: CombatState) => resolveRelicTriggers(shuffledCombat, 'onShuffle'),
    onCardDrawn: applyDrawnCardTriggers,
  };
}

export function endPlayerTurn(combat: CombatState): CombatState {
  if (combat.phase !== 'player') {
    return combat;
  }

  let nextCombat = applyTurnEndCardPowers({
    ...combat,
    log: [...combat.log, '结束回合。'],
  });

  nextCombat = applyTurnEndHandRules(nextCombat, createDrawOptions());
  nextCombat = resolveRelicTriggers(nextCombat, 'onTurnEnd');
  nextCombat = applyPlayerTurnEndStatuses(nextCombat);

  if (nextCombat.player.hp <= 0) {
    return {
      ...nextCombat,
      phase: 'lost',
      log: [...nextCombat.log, '铁誓者倒下了。'],
    };
  }

  return resolveEnemyTurn(nextCombat);
}

export function isCombatWon(combat: CombatState): boolean {
  return combat.phase === 'won' || combat.phase === 'victory';
}

export function isCombatLost(combat: CombatState): boolean {
  return combat.phase === 'lost' || combat.phase === 'defeat';
}

function resolveEnemyTurn(combat: CombatState): CombatState {
  let nextCombat: CombatState = {
    ...combat,
    phase: 'enemy',
    enemies: combat.enemies.map((enemy) =>
      isEnemyAlive(enemy) ? ({ ...enemy, ...prepareForTurnStart(enemy) } as EnemyCombatantState) : enemy,
    ),
  };

  for (const enemy of nextCombat.enemies) {
    if (!isEnemyAlive(enemy)) {
      continue;
    }

    const definition = trainingEnemies.find((candidate) => candidate.id === enemy.definitionId);
    const move = definition?.moves[enemy.moveIndex];
    if (!definition || !move) {
      continue;
    }

    nextCombat = appendLog(nextCombat, `${enemy.name} 使用 ${move.name}。`);

    const skipStatus =
      getStatus(enemy, 'stun') > 0 ? 'stun' : getStatus(enemy, 'slumber') > 0 ? 'slumber' : undefined;
    if (skipStatus) {
      nextCombat = appendLog(nextCombat, `${enemy.name} skips an action.`);
      nextCombat = {
        ...nextCombat,
        enemies: nextCombat.enemies.map((candidate) =>
          candidate.instanceId === enemy.instanceId
            ? setCombatantStatus(candidate, skipStatus, getStatus(candidate, skipStatus) - 1)
            : candidate,
        ),
      };
      nextCombat = advanceEnemyMove(nextCombat, enemy.instanceId, definition);
      continue;
    }

    for (const effect of move.effects) {
      const aliveBefore = getAliveEnemyIds(nextCombat);
      nextCombat = resolveEnemyEffect(nextCombat, enemy.instanceId, effect);
      nextCombat = triggerEnemyKilled(nextCombat, aliveBefore);

      if (nextCombat.player.hp <= 0) {
        return {
          ...nextCombat,
          phase: 'lost',
          log: [...nextCombat.log, '铁誓者倒下了。'],
        };
      }

      const actingEnemy = nextCombat.enemies.find(
        (candidate) => candidate.instanceId === enemy.instanceId,
      );
      if (!actingEnemy || !isEnemyAlive(actingEnemy)) {
        break;
      }
    }

    const actingEnemy = nextCombat.enemies.find(
      (candidate) => candidate.instanceId === enemy.instanceId,
    );
    if (actingEnemy && isEnemyAlive(actingEnemy)) {
      const aliveBefore = getAliveEnemyIds(nextCombat);
      nextCombat = applyEnemyTurnEndStatuses(nextCombat, enemy.instanceId);
      nextCombat = triggerEnemyKilled(nextCombat, aliveBefore);
    }

    const stillAliveEnemy = nextCombat.enemies.find(
      (candidate) => candidate.instanceId === enemy.instanceId,
    );
    if (stillAliveEnemy && isEnemyAlive(stillAliveEnemy)) {
      nextCombat = advanceEnemyMove(nextCombat, enemy.instanceId, definition);
    }
  }

  if (nextCombat.player.hp <= 0) {
    return {
      ...nextCombat,
      phase: 'lost',
      log: [...nextCombat.log, '铁誓者倒下了。'],
    };
  }

  nextCombat = checkCombatEnd(nextCombat);
  if (nextCombat.phase !== 'enemy') {
    return nextCombat;
  }

  return startPlayerTurn(nextCombat);
}

function startPlayerTurn(combat: CombatState): CombatState {
  let readyCombat: CombatState = {
    ...combat,
    turn: combat.turn + 1,
    phase: 'player',
    player: prepareForTurnStart(combat.player),
    energy: combat.maxEnergy,
    turnStats: createTurnStats(),
    log: [...combat.log, `第 ${combat.turn + 1} 回合开始。`],
  };

  readyCombat = drawWithRelicShuffle(readyCombat, STARTING_HAND_SIZE);
  readyCombat = resolveRelicTriggers(readyCombat, 'onTurnStart');
  return applyTurnStartCardPowers(readyCombat);
}

function advanceEnemyMove(
  combat: CombatState,
  enemyId: string,
  definition: EnemyDefinition,
): CombatState {
  return {
    ...combat,
    enemies: combat.enemies.map((enemy) => {
      if (enemy.instanceId !== enemyId) {
        return enemy;
      }

      const nextMoveIndex = (enemy.moveIndex + 1) % definition.moves.length;

      return {
        ...enemy,
        moveIndex: nextMoveIndex,
        intent: definition.moves[nextMoveIndex].intent,
      };
    }),
  };
}

function checkCombatEnd(combat: CombatState): CombatState {
  if (combat.player.hp <= 0) {
    return {
      ...combat,
      phase: 'lost',
      log: [...combat.log, '铁誓者倒下了。'],
    };
  }

  if (combat.enemies.every((enemy) => enemy.defeated || enemy.hp <= 0)) {
    const victoryCombat = resolveRelicTriggers(
      {
        ...combat,
        phase: 'won',
        log: [...combat.log, '战斗胜利。'],
      },
      'onVictory',
    );
    return victoryCombat;
  }

  return combat;
}

function createEnemyCombatant(
  definition: EnemyDefinition,
  index: number,
  ascensionLevel: AscensionLevel,
): EnemyCombatantState {
  const maxHp = getAscensionEnemyMaxHp(definition.maxHp, ascensionLevel);
  return {
    instanceId: `${definition.id}-${index}`,
    definitionId: definition.id,
    name: definition.name,
    lowProfileName: definition.lowProfileName,
    hp: maxHp,
    maxHp,
    block: 0,
    statuses: { ...(definition.initialStatuses ?? {}) },
    moveIndex: 0,
    intent: definition.moves[0].intent,
    defeated: false,
  };
}

function createTurnStats(): CombatTurnStats {
  return {
    cardsPlayed: 0,
    attacksPlayed: 0,
    skillsPlayed: 0,
    powersPlayed: 0,
    cardBlockGains: 0,
    cardsExhausted: 0,
    lostHpThisTurn: false,
    killedEnemyIds: [],
  };
}

function recordCardPlayed(combat: CombatState, cardType: CardType): CombatState {
  return {
    ...combat,
    turnStats: {
      ...combat.turnStats,
      cardsPlayed: combat.turnStats.cardsPlayed + 1,
      attacksPlayed:
        cardType === 'attack' ? combat.turnStats.attacksPlayed + 1 : combat.turnStats.attacksPlayed,
      skillsPlayed:
        cardType === 'skill' ? combat.turnStats.skillsPlayed + 1 : combat.turnStats.skillsPlayed,
      powersPlayed:
        cardType === 'power' ? combat.turnStats.powersPlayed + 1 : combat.turnStats.powersPlayed,
    },
  };
}

function resolveCardTypeRelicTrigger(combat: CombatState, card: CardDefinition): CombatState {
  if (card.type === 'attack') {
    return resolveRelicTriggers(combat, 'onAttackPlayed', { card });
  }

  if (card.type === 'skill') {
    return resolveRelicTriggers(combat, 'onSkillPlayed', { card });
  }

  return combat;
}

function triggerEnemyKilled(combat: CombatState, aliveBefore: Set<string>): CombatState {
  return combat.enemies
    .filter(
      (enemy) =>
        aliveBefore.has(enemy.instanceId) &&
        enemy.hp <= 0 &&
        !combat.turnStats.killedEnemyIds.includes(enemy.instanceId),
    )
    .reduce((nextCombat, enemy) => {
      const withKillRecord: CombatState = {
        ...nextCombat,
        enemies: nextCombat.enemies.map((candidate) =>
          candidate.instanceId === enemy.instanceId
            ? { ...candidate, hp: 0, defeated: true }
            : candidate,
        ),
        turnStats: {
          ...nextCombat.turnStats,
          killedEnemyIds: [...nextCombat.turnStats.killedEnemyIds, enemy.instanceId],
        },
        log: [...nextCombat.log, `${enemy.name} 被击败。`],
      };

      return resolveRelicTriggers(withKillRecord, 'onEnemyKilled', { enemyId: enemy.instanceId });
    }, combat);
}

function applyPlayerTurnEndStatuses(combat: CombatState): CombatState {
  const hpBefore = combat.player.hp;
  const result = applyTurnEndStatusEffects(combat.player);
  const hpLoss = Math.max(0, hpBefore - result.target.hp);
  return {
    ...combat,
    player: result.target,
    combatStats: {
      ...combat.combatStats,
      hpLossEvents: combat.combatStats.hpLossEvents + (hpLoss > 0 ? 1 : 0),
    },
    log: [...combat.log, ...result.log],
  };
}

function applyEnemyTurnEndStatuses(combat: CombatState, enemyId: string): CombatState {
  let statusLog: string[] = [];
  const enemies = combat.enemies.map((enemy) => {
    if (enemy.instanceId !== enemyId) {
      return enemy;
    }

    const result = applyTurnEndStatusEffects(enemy);
    statusLog = result.log;
    return {
      ...enemy,
      ...result.target,
    };
  });

  return {
    ...combat,
    enemies,
    log: [...combat.log, ...statusLog],
  };
}

function drawWithRelicShuffle(combat: CombatState, amount: number): CombatState {
  return drawCards(combat, amount, createDrawOptions());
}

function getAliveEnemyIds(combat: CombatState): Set<string> {
  return new Set(
    combat.enemies.filter(isEnemyAlive).map((enemy) => enemy.instanceId),
  );
}

function isPlayableEnemyTarget(combat: CombatState, targetEnemyId?: string): boolean {
  if (!targetEnemyId) {
    return combat.enemies.some(isEnemyAlive);
  }

  return combat.enemies.some((enemy) => enemy.instanceId === targetEnemyId && isEnemyAlive(enemy));
}

function isEnemyAlive(enemy: EnemyCombatantState): boolean {
  return enemy.hp > 0 && !enemy.defeated;
}

function appendLog<T extends { log: string[]; phase?: CombatPhase; player?: CombatantState }>(
  state: T,
  entry: string,
): T {
  return {
    ...state,
    log: [...state.log, entry],
  };
}

function setCombatantStatus<T extends CombatantState>(target: T, status: StatusId, amount: number): T {
  const statuses = { ...target.statuses };
  if (amount <= 0) {
    delete statuses[status];
  } else {
    statuses[status] = amount;
  }

  return {
    ...target,
    statuses,
  };
}

function uniqueRelics(relics: RelicId[]): RelicId[] {
  return [...new Set(relics)];
}

function pullInnateCardsToOpeningHand(combat: CombatState): CombatState {
  const innateCards: typeof combat.drawPile = [];
  const remainingCards: typeof combat.drawPile = [];

  for (const card of combat.drawPile) {
    const definition = getCardDefinitionForInstance(card);
    if (definition.innate && innateCards.length + combat.hand.length < STARTING_HAND_SIZE) {
      innateCards.push(card);
    } else {
      remainingCards.push(card);
    }
  }

  if (innateCards.length === 0) {
    return combat;
  }

  return {
    ...combat,
    drawPile: remainingCards,
    hand: [...combat.hand, ...innateCards],
    log: [...combat.log, `固有牌进入起始手牌 ${innateCards.length} 张。`],
  };
}
