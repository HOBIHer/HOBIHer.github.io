import { normalTrainingEnemies, trainingEnemies } from '../data/enemies/training';
import { ironOathStarterDeck } from '../data/starterDecks';
import { normalizeSeed, shuffle } from '../rng';
import type {
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
} from '../types';
import { createCardInstances, discardEntireHand, drawCards } from './deck';
import {
  applyTurnEndStatusEffects,
  getCardDefinition,
  prepareForTurnStart,
  resolveCardEffects,
  resolveEnemyEffect,
} from './effects';
import { resolveRelicTriggers } from './relics';

export const STARTING_MAX_HP = 72;
export const STARTING_ENERGY = 3;
export const STARTING_HAND_SIZE = 5;

export function startRun(seed: number | string = Date.now(), relics: RelicId[] = []): RunState {
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
    deck: [...ironOathStarterDeck],
    relics: [...relics],
    combatsWon: 0,
    map: [],
    completedNodeIds: [],
    act: 1,
    floor: 1,
    runStartedAt,
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
  const enemies = enemyDefinitions.map((definition, index) => createEnemyCombatant(definition, index));
  const encounterName = enemies.map((enemy) => enemy.name).join('、');
  const baseCombat: CombatState = {
    id: `${run.id}-combat-${run.combatsWon + 1}`,
    rngSeed: shuffled.seed,
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
    log: [`遭遇 ${encounterName}。`],
  };

  let combat = resolveRelicTriggers(baseCombat, 'onCombatStart');
  combat = drawWithRelicShuffle(combat, STARTING_HAND_SIZE);
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
  const card = getCardDefinition(cardInstance.definitionId);

  if (card.target === 'enemy' && !isPlayableEnemyTarget(combat, targetEnemyId)) {
    return appendLog(combat, '目标已经无法选择。');
  }

  if (combat.energy < card.cost) {
    return appendLog(combat, `能量不足，无法使用 ${card.name}。`);
  }

  const aliveBefore = getAliveEnemyIds(combat);
  const hand = combat.hand.filter((cardInHand) => cardInHand.instanceId !== cardInstanceId);
  let nextCombat: CombatState = {
    ...combat,
    hand,
    energy: combat.energy - card.cost,
    log: [...combat.log, `使用 ${card.name}。`],
  };

  nextCombat = resolveCardEffects(nextCombat, card, targetEnemyId, {
    onShuffle: (shuffledCombat) => resolveRelicTriggers(shuffledCombat, 'onShuffle'),
  });

  const shouldExhaust = card.effects.some((effect) => effect.type === 'exhaustSelf');
  nextCombat = {
    ...nextCombat,
    discardPile: shouldExhaust ? nextCombat.discardPile : [...nextCombat.discardPile, cardInstance],
    exhaustPile: shouldExhaust ? [...nextCombat.exhaustPile, cardInstance] : nextCombat.exhaustPile,
  };

  nextCombat = recordCardPlayed(nextCombat, card.type);
  nextCombat = resolveRelicTriggers(nextCombat, 'onCardPlayed', { card });
  nextCombat = resolveCardTypeRelicTrigger(nextCombat, card);
  nextCombat = triggerEnemyKilled(nextCombat, aliveBefore);

  return checkCombatEnd(nextCombat);
}

export function endPlayerTurn(combat: CombatState): CombatState {
  if (combat.phase !== 'player') {
    return combat;
  }

  let nextCombat = discardEntireHand({
    ...combat,
    log: [...combat.log, '结束回合。'],
  });

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
  return resolveRelicTriggers(readyCombat, 'onTurnStart');
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
): EnemyCombatantState {
  return {
    instanceId: `${definition.id}-${index}`,
    definitionId: definition.id,
    name: definition.name,
    lowProfileName: definition.lowProfileName,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    block: 0,
    statuses: {},
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
  const result = applyTurnEndStatusEffects(combat.player);
  return {
    ...combat,
    player: result.target,
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
  return drawCards(combat, amount, {
    onShuffle: (shuffledCombat) => resolveRelicTriggers(shuffledCombat, 'onShuffle'),
  });
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
