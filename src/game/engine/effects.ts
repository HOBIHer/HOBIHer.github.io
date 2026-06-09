import { rewardWarriorCards } from '../data/cards/warrior';
import { statusDefinitions } from '../data/statuses/statuses';
import { randomInt } from '../rng';
import type {
  CardDefinition,
  CardEffect,
  CardInstance,
  CardCondition,
  CardType,
  CombatState,
  CombatantState,
  EnemyCombatantState,
  EnemyEffect,
  StatusDecayTiming,
  StatusId,
  StatusMap,
} from '../types';
import { getBaseCardDefinition, getEffectiveCardDefinition } from './cardUpgrades';
import { discardFromHand, drawCards, type DrawCardsOptions } from './deck';

interface ResolveCardEffectsOptions {
  playedCard?: CardInstance;
  xValue?: number;
}

interface CardResolutionContext {
  targetEnemyId?: string;
  drawOptions: DrawCardsOptions;
  playedCard?: CardInstance;
  xValue: number;
}

export function getCardDefinition(cardId: string, upgraded = false): CardDefinition {
  return upgraded ? getEffectiveCardDefinition({ definitionId: cardId, instanceId: cardId, upgraded }) : getBaseCardDefinition(cardId);
}

export function getCardDefinitionForInstance(card: CardInstance): CardDefinition {
  return getEffectiveCardDefinition(card);
}

export function getStatus(combatant: CombatantState, status: StatusId): number {
  return combatant.statuses[status] ?? 0;
}

export function getCardPlayCost(
  combat: CombatState,
  cardInstance: CardInstance,
  card: CardDefinition = getCardDefinitionForInstance(cardInstance),
): number {
  if (typeof cardInstance.costOverride === 'number') {
    return Math.max(0, cardInstance.costOverride);
  }

  let cost = card.cost === 'X' ? combat.energy : card.cost;

  if (card.type === 'skill' && getStatus(combat.player, 'skillZeroExhaust') > 0) {
    cost = 0;
  }

  if (card.type === 'attack' && getStatus(combat.player, 'nextAttackFree') > 0) {
    cost = 0;
  }

  if (card.effects.some((effect) => effect.type === 'costReducedByAttacksPlayedThisTurn')) {
    cost = Math.max(0, cost - combat.turnStats.attacksPlayed);
  }

  return Math.max(0, cost);
}

export function getCardXValue(
  combat: CombatState,
  cardInstance: CardInstance,
  card: CardDefinition = getCardDefinitionForInstance(cardInstance),
): number {
  return card.cost === 'X' ? getCardPlayCost(combat, cardInstance, card) : 0;
}

export function getCardPlayBlockReason(combat: CombatState, card: CardDefinition): string | undefined {
  const exhaustRequirement = card.effects.find((effect) => effect.type === 'requireExhaustPileAtLeast');
  if (exhaustRequirement && combat.exhaustPile.length < exhaustRequirement.amount) {
    return `消耗堆中至少需要 ${exhaustRequirement.amount} 张牌。`;
  }

  return undefined;
}

export function calculateAttackDamage(
  baseAmount: number,
  attacker: CombatantState,
  defender: CombatantState,
): number {
  let amount = Math.max(
    0,
    baseAmount +
      getStatus(attacker, 'strength') *
        (statusDefinitions.strength.attackDamageDealtFlatPerStack ?? 0),
  );

  if (getStatus(attacker, 'weak') > 0) {
    amount = Math.floor(amount * (statusDefinitions.weak.attackDamageDealtMultiplier ?? 1));
  }

  if (getStatus(defender, 'vulnerable') > 0) {
    amount = Math.floor(
      amount * (statusDefinitions.vulnerable.attackDamageReceivedMultiplier ?? 1),
    );
    const vulnerableBonus = getStatus(attacker, 'vulnerableDamageBonus');
    if (vulnerableBonus > 0) {
      amount = Math.floor(amount * (1 + vulnerableBonus / 100));
    }
  }

  return Math.max(0, amount);
}

export function calculateBlockGain(baseAmount: number, target: CombatantState): number {
  let amount = Math.max(
    0,
    baseAmount +
      getStatus(target, 'dexterity') *
        (statusDefinitions.dexterity.blockGainFlatPerStack ?? 0),
  );

  if (getStatus(target, 'frail') > 0) {
    amount = Math.floor(amount * (statusDefinitions.frail.blockGainMultiplier ?? 1));
  }

  return Math.max(0, amount);
}

export function addBlock(target: CombatantState, amount: number): CombatantState {
  const blockGain = calculateBlockGain(amount, target);
  return {
    ...target,
    block: target.block + blockGain,
  };
}

export function dealDamage(target: CombatantState, amount: number): {
  target: CombatantState;
  hpLoss: number;
  blocked: number;
} {
  const blocked = Math.min(target.block, amount);
  const hpLoss = Math.min(target.hp, Math.max(0, amount - blocked));

  return {
    target: {
      ...target,
      block: target.block - blocked,
      hp: target.hp - hpLoss,
    },
    hpLoss,
    blocked,
  };
}

export function loseHp(target: CombatantState, amount: number): {
  target: CombatantState;
  hpLoss: number;
} {
  const hpLoss = Math.min(target.hp, Math.max(0, amount));
  return {
    target: {
      ...target,
      hp: target.hp - hpLoss,
    },
    hpLoss,
  };
}

export function healHp(target: CombatantState, amount: number): {
  target: CombatantState;
  healed: number;
} {
  const healed = Math.min(target.maxHp - target.hp, Math.max(0, amount));
  return {
    target: {
      ...target,
      hp: target.hp + healed,
    },
    healed,
  };
}

export function addStatus(
  target: CombatantState,
  status: StatusId,
  amount: number,
): { target: CombatantState; prevented: boolean } {
  const definition = statusDefinitions[status];

  if (definition.isNegative && getStatus(target, 'artifact') > 0) {
    return {
      target: setStatus(target, 'artifact', getStatus(target, 'artifact') - 1),
      prevented: true,
    };
  }

  return {
    target: setStatus(target, status, getStatus(target, status) + amount),
    prevented: false,
  };
}

export function decayStatuses(
  target: CombatantState,
  timing: StatusDecayTiming = 'turnEnd',
): CombatantState {
  let next = target;

  for (const definition of Object.values(statusDefinitions)) {
    if (definition.decayTiming !== timing) {
      continue;
    }

    const current = getStatus(next, definition.id);
    if (current > 0) {
      next = setStatus(next, definition.id, current - 1);
    }
  }

  return next;
}

export function prepareForTurnStart(target: CombatantState): CombatantState {
  const shouldPreserveBlock =
    (getStatus(target, 'barrierLock') > 0 &&
      Boolean(statusDefinitions.barrierLock.preservesBlockAtTurnStart)) ||
    (getStatus(target, 'blockRetention') > 0 &&
      Boolean(statusDefinitions.blockRetention.preservesBlockEveryTurn));

  const withBlockRule = shouldPreserveBlock ? target : { ...target, block: 0 };
  return decayStatuses(withBlockRule, 'turnStart');
}

export function applyTurnEndStatusEffects(target: CombatantState): {
  target: CombatantState;
  log: string[];
} {
  let next = target;
  const log: string[] = [];

  const regen = getStatus(next, 'regen');
  if (regen > 0) {
    const result = healHp(next, regen * (statusDefinitions.regen.turnEndHealPerStack ?? 0));
    next = result.target;
    if (result.healed > 0) {
      log.push(`${target.name} 通过再生回复 ${result.healed} 点生命。`);
    }
  }

  const bleed = getStatus(next, 'bleed');
  if (bleed > 0) {
    const result = loseHp(next, bleed * (statusDefinitions.bleed.turnEndHpLossPerStack ?? 0));
    next = result.target;
    if (result.hpLoss > 0) {
      log.push(`${target.name} 因流血失去 ${result.hpLoss} 点生命。`);
    }
  }

  const temporaryStrength = getStatus(next, 'temporaryStrength');
  if (temporaryStrength !== 0) {
    next = setStatus(next, 'strength', getStatus(next, 'strength') - temporaryStrength);
    next = setStatus(next, 'temporaryStrength', 0);
  }

  return {
    target: decayStatuses(next, 'turnEnd'),
    log,
  };
}

export function resolveCardEffects(
  combat: CombatState,
  card: CardDefinition,
  targetEnemyId?: string,
  drawOptions: DrawCardsOptions = {},
  options: ResolveCardEffectsOptions = {},
): CombatState {
  const context: CardResolutionContext = {
    targetEnemyId,
    drawOptions,
    playedCard: options.playedCard,
    xValue: options.xValue ?? 0,
  };

  return card.effects.reduce((nextCombat, effect) => {
    if (
      effect.type === 'exhaustSelf' ||
      effect.type === 'requireExhaustPileAtLeast' ||
      effect.type === 'costReducedByAttacksPlayedThisTurn' ||
      effect.type === 'increaseThisCardDamage' ||
      effect.type === 'exhaustRandomAttackAndAddDamageToThisCard' ||
      effect.type === 'autoPlayFromExhaust'
    ) {
      return nextCombat;
    }

    return resolveCardEffect(nextCombat, card, effect, context);
  }, combat);
}

export function recordExhaustedCards(
  combat: CombatState,
  cards: CardInstance[],
  drawOptions: DrawCardsOptions = {},
): CombatState {
  if (cards.length === 0) {
    return combat;
  }

  let nextCombat: CombatState = {
    ...combat,
    turnStats: {
      ...combat.turnStats,
      cardsExhausted: combat.turnStats.cardsExhausted + cards.length,
    },
  };

  for (const card of cards) {
    const drawAmount = getStatus(nextCombat.player, 'drawOnExhaust');
    if (drawAmount > 0) {
      nextCombat = drawCards(nextCombat, drawAmount, drawOptions);
    }

    const blockAmount = getStatus(nextCombat.player, 'blockOnExhaust');
    if (blockAmount > 0) {
      nextCombat = gainPlayerBlock(nextCombat, blockAmount, '消耗触发', false);
    }

    nextCombat = {
      ...nextCombat,
      log: [...nextCombat.log, `${getCardDefinitionForInstance(card).name} 被消耗。`],
    };
  }

  return nextCombat;
}

export function applyPlayedCardPostEffects(
  combat: CombatState,
  card: CardDefinition,
  playedCard: CardInstance,
  drawOptions: DrawCardsOptions = {},
): { combat: CombatState; playedCard: CardInstance } {
  let nextCombat = combat;
  let nextPlayedCard = { ...playedCard };

  for (const effect of card.effects) {
    if (effect.type === 'increaseThisCardDamage') {
      nextPlayedCard = {
        ...nextPlayedCard,
        damageBonus: (nextPlayedCard.damageBonus ?? 0) + effect.amount,
      };
      nextCombat = {
        ...nextCombat,
        log: [...nextCombat.log, `${card.name} 在本场战斗中伤害提高 ${effect.amount}。`],
      };
    }

    if (effect.type === 'exhaustRandomAttackAndAddDamageToThisCard') {
      const candidates = nextCombat.hand.filter((candidate) => {
        const definition = getCardDefinitionForInstance(candidate);
        return definition.type === 'attack';
      });

      if (candidates.length === 0) {
        continue;
      }

      const random = randomInt(nextCombat.rngSeed, candidates.length);
      const selected = candidates[random.value];
      const selectedDefinition = getCardDefinitionForInstance(selected);
      const bonus = getPrimaryDamageAmount(selectedDefinition.effects);
      nextCombat = {
        ...nextCombat,
        rngSeed: random.seed,
        hand: nextCombat.hand.filter((candidate) => candidate.instanceId !== selected.instanceId),
        exhaustPile: [...nextCombat.exhaustPile, selected],
        log: [...nextCombat.log, `${card.name} 消耗 ${selectedDefinition.name}，本牌伤害提高 ${bonus}。`],
      };
      nextCombat = recordExhaustedCards(nextCombat, [selected], drawOptions);
      nextPlayedCard = {
        ...nextPlayedCard,
        damageBonus: (nextPlayedCard.damageBonus ?? 0) + bonus,
      };
    }
  }

  return { combat: nextCombat, playedCard: nextPlayedCard };
}

export function applyAfterCardPlayedPowers(
  combat: CombatState,
  card: CardDefinition,
  playedCard: CardInstance,
  targetEnemyId?: string,
  drawOptions: DrawCardsOptions = {},
): CombatState {
  let nextCombat = combat;

  if (card.type === 'attack') {
    const attackBlock = getStatus(nextCombat.player, 'attackBlockThisTurn');
    if (attackBlock > 0) {
      nextCombat = gainPlayerBlock(nextCombat, attackBlock, '攻击触发', false);
    }

    if (getStatus(nextCombat.player, 'thirdAttackCopy') > 0 && nextCombat.turnStats.attacksPlayed === 3) {
      const copy = cloneCardInstance(playedCard, `third-copy-${nextCombat.turn}-${playedCard.instanceId}`);
      nextCombat = {
        ...nextCombat,
        hand: [...nextCombat.hand, copy],
        log: [...nextCombat.log, `${card.name} 的第 3 张攻击触发复制。`],
      };
    }

    const extraPlays = getStatus(nextCombat.player, 'nextAttackExtraPlay');
    if (extraPlays > 0) {
      nextCombat = {
        ...nextCombat,
        player: setStatus(nextCombat.player, 'nextAttackExtraPlay', extraPlays - 1),
        log: [...nextCombat.log, `${card.name} 额外打出 1 次。`],
      };
      nextCombat = resolveCardEffects(nextCombat, card, targetEnemyId, drawOptions, {
        playedCard,
        xValue: 0,
      });
    }

    const freeAttacks = getStatus(nextCombat.player, 'nextAttackFree');
    if (freeAttacks > 0) {
      nextCombat = {
        ...nextCombat,
        player: setStatus(nextCombat.player, 'nextAttackFree', freeAttacks - 1),
      };
    }
  }

  return nextCombat;
}

export function applyTurnStartCardPowers(combat: CombatState): CombatState {
  let nextCombat = combat;

  const startEnergy = getStatus(nextCombat.player, 'startTurnEnergy');
  if (startEnergy > 0) {
    nextCombat = gainEnergy(nextCombat, '回合配额', startEnergy);
  }

  const startStrength = getStatus(nextCombat.player, 'startTurnStrength');
  if (startStrength > 0) {
    const result = addStatus(nextCombat.player, 'strength', startStrength);
    nextCombat = {
      ...nextCombat,
      player: result.target,
      log: [...nextCombat.log, `回合开始获得 ${startStrength} 层力量。`],
    };
  }

  const startLoseHpBlock = getStatus(nextCombat.player, 'startTurnLoseHpBlock');
  if (startLoseHpBlock > 0) {
    nextCombat = applyPlayerHpLoss(nextCombat, '血盾轮转', 1, true);
    nextCombat = gainPlayerBlock(nextCombat, startLoseHpBlock, '血盾轮转', false);
  }

  const startLoseHpDamageAll = getStatus(nextCombat.player, 'startTurnLoseHpDamageAll');
  if (startLoseHpDamageAll > 0) {
    nextCombat = applyPlayerHpLoss(nextCombat, '血钟启动', 1, true);
  }

  const exhaustTop = getStatus(nextCombat.player, 'startTurnExhaustTopCard');
  for (let index = 0; index < exhaustTop; index += 1) {
    const topCard = nextCombat.drawPile[0];
    if (!topCard) {
      break;
    }
    nextCombat = {
      ...nextCombat,
      drawPile: nextCombat.drawPile.slice(1),
      exhaustPile: [...nextCombat.exhaustPile, topCard],
      log: [...nextCombat.log, `回合开始消耗抽牌堆顶牌。`],
    };
    nextCombat = recordExhaustedCards(nextCombat, [topCard]);
  }

  const recallAttack = getStatus(nextCombat.player, 'startTurnRecallAttack');
  for (let index = 0; index < recallAttack; index += 1) {
    nextCombat = recallRandomAttackFromDiscard(nextCombat);
  }

  return autoPlayFromExhaust(nextCombat, 'turnStart');
}

export function applyTurnEndCardPowers(combat: CombatState): CombatState {
  let nextCombat = combat;

  if (getStatus(nextCombat.player, 'endTurnAutoPlayAttack') > 0) {
    const attack = nextCombat.hand.find((candidate) => getCardDefinitionForInstance(candidate).type === 'attack');
    if (attack) {
      nextCombat = {
        ...nextCombat,
        hand: nextCombat.hand.filter((candidate) => candidate.instanceId !== attack.instanceId),
      };
      nextCombat = playCardInstanceForFree(nextCombat, attack, undefined, false);
    }
  }

  return autoPlayFromExhaust(nextCombat, 'turnEnd');
}

export function applyDrawnCardTriggers(combat: CombatState, drawnCard: CardInstance): CombatState {
  if (getStatus(combat.player, 'autoPlayDrawnBasicAttack') <= 0 || !isBasicAttackLike(drawnCard)) {
    return combat;
  }

  const inHand = combat.hand.some((card) => card.instanceId === drawnCard.instanceId);
  if (!inHand) {
    return combat;
  }

  const nextCombat = {
    ...combat,
    hand: combat.hand.filter((card) => card.instanceId !== drawnCard.instanceId),
    log: [...combat.log, `${getCardDefinitionForInstance(drawnCard).name} 被自动打出。`],
  };
  return playCardInstanceForFree(nextCombat, drawnCard, undefined, false);
}

function resolveCardEffect(
  combat: CombatState,
  card: CardDefinition,
  effect: Exclude<CardEffect, { type: 'exhaustSelf' }>,
  context: CardResolutionContext,
): CombatState {
  if (effect.type === 'draw') {
    return drawCards(combat, effect.amount, context.drawOptions);
  }

  if (effect.type === 'drawUntilCardType') {
    return drawUntilCardType(combat, effect.cardType, Boolean(effect.invert), context.drawOptions);
  }

  if (effect.type === 'discard') {
    return discardFromHand(combat, effect.amount);
  }

  if (effect.type === 'copySelfToDiscard') {
    if (!context.playedCard) {
      return combat;
    }

    return {
      ...combat,
      discardPile: [
        ...combat.discardPile,
        ...Array.from({ length: effect.amount }, (_, index) =>
          cloneCardInstance(context.playedCard!, `copy-discard-${combat.turn}-${index}-${context.playedCard!.instanceId}`),
        ),
      ],
      log: [...combat.log, `${card.name} 复制 ${effect.amount} 张到弃牌堆。`],
    };
  }

  if (effect.type === 'copySelfToHand') {
    if (!context.playedCard) {
      return combat;
    }

    return {
      ...combat,
      hand: [
        ...combat.hand,
        ...Array.from({ length: effect.amount }, (_, index) =>
          cloneCardInstance(context.playedCard!, `copy-hand-${combat.turn}-${index}-${context.playedCard!.instanceId}`),
        ),
      ],
      log: [...combat.log, `${card.name} 复制 ${effect.amount} 张到手牌。`],
    };
  }

  if (effect.type === 'upgradeCardsInHand') {
    const limit = effect.amount === 'all' ? combat.hand.length : effect.amount;
    let upgraded = 0;
    const hand = combat.hand.map((candidate) => {
      if (upgraded >= limit || candidate.upgraded) {
        return candidate;
      }
      upgraded += 1;
      return { ...candidate, upgraded: true };
    });
    return {
      ...combat,
      hand,
      log: [...combat.log, `${card.name} 升级手牌 ${upgraded} 张。`],
    };
  }

  if (effect.type === 'preventDrawThisTurn') {
    return {
      ...combat,
      player: addStatus(combat.player, 'noDraw', 1).target,
      log: [...combat.log, `${card.name} 封锁本回合后续抽牌。`],
    };
  }

  if (effect.type === 'exhaustFromHand') {
    return exhaustFromHandByRule(combat, effect, context.drawOptions);
  }

  if (effect.type === 'moveDiscardToDrawTop') {
    const moved = combat.discardPile.slice(0, effect.amount);
    if (moved.length === 0) {
      return combat;
    }
    return {
      ...combat,
      discardPile: combat.discardPile.slice(moved.length),
      drawPile: [...moved, ...combat.drawPile],
      log: [...combat.log, `${card.name} 将 ${moved.length} 张弃牌放到抽牌堆顶。`],
    };
  }

  if (effect.type === 'playTopCards') {
    const count =
      effect.count === 'x'
        ? context.xValue
        : effect.count === 'xPlusOne'
          ? context.xValue + 1
          : effect.count;
    return playTopCards(combat, count, Boolean(effect.exhaustPlayed), context.drawOptions);
  }

  if (effect.type === 'gainEnergy') {
    return gainEnergy(combat, card.name, effect.amount);
  }

  if (effect.type === 'gainEnergyPerCardInHand') {
    const amount = combat.hand.filter((candidate) => getCardDefinitionForInstance(candidate).type === effect.cardType).length;
    return gainEnergy(combat, card.name, amount);
  }

  if (effect.type === 'preventEnergyGainThisTurn') {
    return {
      ...combat,
      player: addStatus(combat.player, 'noEnergyGain', 1).target,
      log: [...combat.log, `${card.name} 封锁本回合后续额外能量。`],
    };
  }

  if (effect.type === 'loseHp') {
    return applyPlayerHpLoss(combat, card.name, effect.amount, combat.phase === 'player');
  }

  if (effect.type === 'heal') {
    const result = healHp(combat.player, effect.amount);
    return {
      ...combat,
      player: result.target,
      log: [...combat.log, `${card.name} 回复 ${result.healed} 点生命。`],
    };
  }

  if (effect.type === 'block') {
    return gainPlayerBlock(combat, effect.amount, card.name, true);
  }

  if (effect.type === 'blockNextTurn') {
    const blockedCombat = gainPlayerBlock(combat, effect.amount, card.name, true);
    const result = addStatus(blockedCombat.player, 'barrierLock', 1);
    return {
      ...blockedCombat,
      player: result.target,
      log: [...blockedCombat.log, `${card.name} 预留下回合格挡。`],
    };
  }

  if (effect.type === 'blockPerCardsExhaustedThisTurn') {
    return gainPlayerBlock(
      combat,
      effect.amountPerCard * combat.turnStats.cardsExhausted,
      card.name,
      true,
    );
  }

  if (effect.type === 'applyStatus') {
    return applyStatusEffect(combat, card, effect.status, effect.amount, effect.target, context);
  }

  if (effect.type === 'applyStatusAll') {
    return combat.enemies.reduce((nextCombat, enemy) => {
      if (!isEnemyAlive(enemy)) {
        return nextCombat;
      }
      return applyStatusToEnemy(nextCombat, card, enemy.instanceId, effect.status, effect.amount, context.drawOptions);
    }, combat);
  }

  if (effect.type === 'gainStatusPerTargetStatusStack') {
    const target = getTargetEnemy(combat, context.targetEnemyId);
    const stacks = target ? getStatus(target, effect.targetStatus) : 0;
    if (stacks <= 0) {
      return combat;
    }
    const result = addStatus(combat.player, effect.status, stacks * effect.amountPerStack);
    return {
      ...combat,
      player: result.target,
      log: [...combat.log, `${card.name} 获得 ${stacks * effect.amountPerStack} 层${statusLabel(effect.status)}。`],
    };
  }

  if (effect.type === 'damage') {
    if (effect.target === 'allEnemies') {
      return damageAllEnemies(combat, card, effect.amount);
    }

    return damageEnemy(combat, card, context.targetEnemyId ?? getFirstAliveEnemyId(combat), effect.amount);
  }

  if (effect.type === 'damageAll') {
    return damageAllEnemies(combat, card, effect.amount);
  }

  if (effect.type === 'damageRepeated') {
    const times =
      effect.times === 'x'
        ? context.xValue
        : effect.times === 'hpLossEventsThisCombat'
          ? 1 + combat.combatStats.hpLossEvents
          : effect.times;
    let nextCombat = combat;
    for (let index = 0; index < times; index += 1) {
      nextCombat = damageEnemy(nextCombat, card, context.targetEnemyId ?? getFirstAliveEnemyId(nextCombat), effect.amount);
    }
    return nextCombat;
  }

  if (effect.type === 'damageRandomEnemy') {
    let nextCombat = combat;
    for (let index = 0; index < effect.times; index += 1) {
      nextCombat = damageRandomEnemy(nextCombat, card, effect.amount);
    }
    return nextCombat;
  }

  if (effect.type === 'damageAllRepeated') {
    let nextCombat = combat;
    for (let index = 0; index < context.xValue; index += 1) {
      nextCombat = damageAllEnemies(nextCombat, card, effect.amount);
    }
    return nextCombat;
  }

  if (effect.type === 'damageAllPerAttackPlayed') {
    return damageAllEnemies(
      combat,
      card,
      effect.baseAmount + effect.amountPerAttack * combat.turnStats.attacksPlayed,
    );
  }

  if (effect.type === 'damagePerPileCard') {
    const amount = effect.amountPerCard * combat.exhaustPile.length;
    return amount > 0
      ? damageEnemy(combat, card, context.targetEnemyId ?? getFirstAliveEnemyId(combat), amount)
      : combat;
  }

  if (effect.type === 'damagePerStatusStack') {
    const target = getTargetEnemy(combat, context.targetEnemyId);
    const amount = target ? getStatus(target, effect.status) * effect.amountPerStack : 0;
    return amount > 0
      ? damageEnemy(combat, card, target?.instanceId, amount)
      : combat;
  }

  if (effect.type === 'damagePerCardsExhaustedThisTurn') {
    const amount = effect.amountPerCard * combat.turnStats.cardsExhausted;
    return amount > 0
      ? damageEnemy(combat, card, context.targetEnemyId ?? getFirstAliveEnemyId(combat), amount)
      : combat;
  }

  if (effect.type === 'damagePerBasicAttackCard') {
    const amount = effect.amountPerCard * countBasicAttackCards(combat, context.playedCard);
    return amount > 0
      ? damageEnemy(combat, card, context.targetEnemyId ?? getFirstAliveEnemyId(combat), amount)
      : combat;
  }

  if (effect.type === 'damageEqualToBlock') {
    return damageEnemy(combat, card, context.targetEnemyId ?? getFirstAliveEnemyId(combat), combat.player.block);
  }

  if (effect.type === 'gainMaxHpIfTargetKilled') {
    const target = getTargetEnemy(combat, context.targetEnemyId);
    if (!target || target.hp > 0) {
      return combat;
    }
    return {
      ...combat,
      player: {
        ...combat.player,
        maxHp: combat.player.maxHp + effect.amount,
      },
      log: [...combat.log, `${card.name} 使最大生命提高 ${effect.amount}。`],
    };
  }

  if (effect.type === 'addRandomCardToHand') {
    return addRandomCardToHand(combat, effect);
  }

  if (effect.type === 'addRandomCardsPerCardsExhaustedThisTurn') {
    let nextCombat = combat;
    for (let index = 0; index < combat.turnStats.cardsExhausted; index += 1) {
      nextCombat = addRandomCardToHand(nextCombat, {
        type: 'addRandomCardToHand',
        upgraded: effect.upgraded,
      });
    }
    return nextCombat;
  }

  if (effect.type === 'doubleTargetStatus') {
    return updateEnemy(combat, context.targetEnemyId ?? getFirstAliveEnemyId(combat), (enemy) => ({
      enemy: setStatus(enemy, effect.status, getStatus(enemy, effect.status) * 2),
      log: `${card.name} 使 ${enemy.name} 的${statusLabel(effect.status)}翻倍。`,
    }));
  }

  if (effect.type === 'gainTemporaryStrength') {
    if (effect.target === 'player') {
      return gainTemporaryStrength(combat, card.name, effect.amount, 'player', context.targetEnemyId);
    }
    return gainTemporaryStrength(combat, card.name, effect.amount, 'enemy', context.targetEnemyId);
  }

  if (effect.type === 'setNextAttackExtraPlay') {
    return {
      ...combat,
      player: addStatus(combat.player, 'nextAttackExtraPlay', effect.count).target,
      log: [...combat.log, `${card.name} 准备 ${effect.count} 次攻击追击。`],
    };
  }

  if (effect.type === 'setNextAttackFree') {
    return {
      ...combat,
      player: addStatus(combat.player, 'nextAttackFree', effect.count).target,
      log: [...combat.log, `${card.name} 使下一张攻击牌费用变为 0。`],
    };
  }

  if (effect.type === 'conditional') {
    const conditionMet = isCardConditionMet(combat, effect.condition, context.targetEnemyId);
    const branchEffects = conditionMet ? effect.effects : effect.elseEffects ?? [];
    return branchEffects.reduce((nextCombat, branchEffect) => {
      if (branchEffect.type === 'exhaustSelf') {
        return nextCombat;
      }

      return resolveCardEffect(
        nextCombat,
        card,
        branchEffect as Exclude<CardEffect, { type: 'exhaustSelf' }>,
        context,
      );
    }, combat);
  }

  return combat;
}

function applyStatusEffect(
  combat: CombatState,
  card: CardDefinition,
  status: StatusId,
  amount: number,
  target: 'player' | 'enemy',
  context: CardResolutionContext,
): CombatState {
  if (target === 'player') {
    const result = addStatus(combat.player, status, amount);
    return {
      ...combat,
      player: result.target,
      log: [
        ...combat.log,
        result.prevented
          ? `${card.name} 的状态被抵消。`
          : `${card.name} 使铁誓者获得 ${amount} 层${statusLabel(status)}。`,
      ],
    };
  }

  return applyStatusToEnemy(
    combat,
    card,
    context.targetEnemyId ?? getFirstAliveEnemyId(combat),
    status,
    amount,
    context.drawOptions,
  );
}

function applyStatusToEnemy(
  combat: CombatState,
  card: CardDefinition,
  targetEnemyId: string | undefined,
  status: StatusId,
  amount: number,
  drawOptions: DrawCardsOptions = {},
): CombatState {
  let applied = false;
  const nextCombat = updateEnemy(combat, targetEnemyId, (enemy) => {
    const result = addStatus(enemy, status, amount);
    applied = !result.prevented;
    return {
      enemy: result.target,
      log: result.prevented
        ? `${card.name} 对 ${enemy.name} 的状态被抵消。`
        : `${card.name} 对 ${enemy.name} 施加 ${amount} 层${statusLabel(status)}。`,
    };
  });

  if (status !== 'vulnerable' || !applied) {
    return nextCombat;
  }

  const drawOnVulnerable = getStatus(nextCombat.player, 'drawOnVulnerable');
  return drawOnVulnerable > 0 ? drawCards(nextCombat, drawOnVulnerable, drawOptions) : nextCombat;
}

export function resolveEnemyEffect(
  combat: CombatState,
  enemyId: string,
  effect: EnemyEffect,
): CombatState {
  const actingEnemy = combat.enemies.find((enemy) => enemy.instanceId === enemyId);
  if (!actingEnemy || !isEnemyAlive(actingEnemy)) {
    return combat;
  }

  if (effect.type === 'damage') {
    let amount = calculateAttackDamage(effect.amount, actingEnemy, combat.player);
    if (getStatus(actingEnemy, 'vulnerable') > 0 && getStatus(combat.player, 'vulnerableEnemyDamageReduction') > 0) {
      amount = Math.floor(amount * (1 - getStatus(combat.player, 'vulnerableEnemyDamageReduction') / 100));
    }

    const result = dealDamage(combat.player, amount);
    let nextCombat: CombatState = {
      ...combat,
      player: result.target,
      combatStats: {
        ...combat.combatStats,
        hpLossEvents: combat.combatStats.hpLossEvents + (result.hpLoss > 0 ? 1 : 0),
      },
      log: [
        ...combat.log,
        `${actingEnemy.name} 造成 ${amount} 点伤害，${result.blocked} 点被格挡。`,
      ],
    };

    const counterAttack = getStatus(combat.player, 'counterAttack');
    if (counterAttack > 0) {
      nextCombat = damageEnemy(nextCombat, { ...getBaseCardDefinition('short-blade-advance'), name: '反击' }, enemyId, counterAttack);
    }

    const thorns = getStatus(combat.player, 'thorns');
    if (thorns > 0 && result.hpLoss > 0) {
      nextCombat = updateEnemy(nextCombat, enemyId, (enemy) => {
        const thornDamage =
          thorns * (statusDefinitions.thorns.thornsDamagePerStack ?? 0);
        const thornResult = dealDamage(enemy, thornDamage);
        return {
          enemy: thornResult.target,
          log: `${enemy.name} 受到 ${thornDamage} 点反击伤害。`,
        };
      });
    }

    return nextCombat;
  }

  if (effect.type === 'block') {
    return updateEnemy(combat, enemyId, (enemy) => {
      const blockedEnemy = addBlock(enemy, effect.amount);
      return {
        enemy: blockedEnemy,
        log: `${enemy.name} 获得 ${blockedEnemy.block - enemy.block} 点格挡。`,
      };
    });
  }

  if (effect.type === 'applyStatus') {
    if (effect.target === 'player') {
      const result = addStatus(combat.player, effect.status, effect.amount);
      return {
        ...combat,
        player: result.target,
        log: [
          ...combat.log,
          result.prevented
            ? `${actingEnemy.name} 的状态被抵消。`
            : `${actingEnemy.name} 施加 ${effect.amount} 层${statusLabel(effect.status)}。`,
        ],
      };
    }

    return updateEnemy(combat, enemyId, (enemy) => {
      const result = addStatus(enemy, effect.status, effect.amount);
      return {
        enemy: result.target,
        log: result.prevented
          ? `${enemy.name} 的状态被抵消。`
          : `${enemy.name} 获得 ${effect.amount} 层${statusLabel(effect.status)}。`,
      };
    });
  }

  return combat;
}

function damageAllEnemies(combat: CombatState, card: CardDefinition, amount: number): CombatState {
  return combat.enemies.reduce((nextCombat, enemy) => {
    if (!isEnemyAlive(enemy)) {
      return nextCombat;
    }
    return damageEnemy(nextCombat, card, enemy.instanceId, amount);
  }, combat);
}

function damageRandomEnemy(combat: CombatState, card: CardDefinition, amount: number): CombatState {
  const enemies = combat.enemies.filter(isEnemyAlive);
  if (enemies.length === 0) {
    return combat;
  }

  const random = randomInt(combat.rngSeed, enemies.length);
  return damageEnemy({ ...combat, rngSeed: random.seed }, card, enemies[random.value].instanceId, amount);
}

function damageEnemy(
  combat: CombatState,
  card: CardDefinition,
  targetEnemyId: string | undefined,
  baseAmount: number,
): CombatState {
  return updateEnemy(combat, targetEnemyId, (enemy) => {
    const amount = calculateAttackDamage(baseAmount, combat.player, enemy);
    const result = dealDamage(enemy, amount);
    let nextPlayer = combat.player;
    let thornLog = '';
    const thorns = getStatus(enemy, 'thorns');

    if (thorns > 0 && result.hpLoss > 0) {
      const thornDamage = thorns * (statusDefinitions.thorns.thornsDamagePerStack ?? 0);
      const thornResult = dealDamage(combat.player, thornDamage);
      nextPlayer = thornResult.target;
      thornLog = ` ${combat.player.name} 受到 ${thornDamage} 点反击伤害。`;
    }

    return {
      enemy: result.target,
      player: nextPlayer,
      log: `${card.name} 对 ${enemy.name} 造成 ${amount} 点伤害，${result.blocked} 点被格挡。${thornLog}`,
    };
  });
}

function gainPlayerBlock(
  combat: CombatState,
  amount: number,
  sourceName: string,
  fromCard: boolean,
): CombatState {
  const shouldDouble =
    fromCard &&
    getStatus(combat.player, 'firstCardBlockDouble') > 0 &&
    combat.turnStats.cardBlockGains === 0;
  const baseAmount = shouldDouble ? amount * 2 : amount;
  const player = addBlock(combat.player, baseAmount);
  const gained = player.block - combat.player.block;
  let nextCombat: CombatState = {
    ...combat,
    player,
    turnStats: {
      ...combat.turnStats,
      cardBlockGains: combat.turnStats.cardBlockGains + (fromCard ? 1 : 0),
    },
    log: [...combat.log, `${sourceName} 提供 ${gained} 点格挡。`],
  };

  const damageOnBlock = getStatus(nextCombat.player, 'damageRandomOnBlock');
  if (gained > 0 && damageOnBlock > 0) {
    nextCombat = damageRandomEnemy(nextCombat, { ...getBaseCardDefinition('short-blade-advance'), name: '格挡震击' }, damageOnBlock);
  }

  return nextCombat;
}

function gainEnergy(combat: CombatState, sourceName: string, amount: number): CombatState {
  if (amount <= 0) {
    return combat;
  }

  if (getStatus(combat.player, 'noEnergyGain') > 0) {
    return {
      ...combat,
      log: [...combat.log, `${sourceName} 的额外能量被封锁。`],
    };
  }

  return {
    ...combat,
    energy: combat.energy + amount,
    log: [...combat.log, `${sourceName} 提供 ${amount} 点能量。`],
  };
}

function applyPlayerHpLoss(
  combat: CombatState,
  sourceName: string,
  amount: number,
  ownTurn: boolean,
): CombatState {
  const result = loseHp(combat.player, amount);
  let nextCombat: CombatState = {
    ...combat,
    player: result.target,
    combatStats: {
      ...combat.combatStats,
      hpLossEvents: combat.combatStats.hpLossEvents + (result.hpLoss > 0 ? 1 : 0),
    },
    turnStats: {
      ...combat.turnStats,
      lostHpThisTurn: combat.turnStats.lostHpThisTurn || result.hpLoss > 0,
    },
    log: [...combat.log, `${sourceName} 使铁誓者失去 ${result.hpLoss} 点生命。`],
  };

  if (result.hpLoss <= 0 || !ownTurn) {
    return nextCombat;
  }

  const damageAll = getStatus(nextCombat.player, 'damageAllOnHpLoss');
  if (damageAll > 0) {
    nextCombat = damageAllEnemies(nextCombat, { ...getBaseCardDefinition('short-blade-advance'), name: '失血震荡' }, damageAll);
  }

  const strength = getStatus(nextCombat.player, 'hpLossStrength');
  if (strength > 0) {
    const statusResult = addStatus(nextCombat.player, 'strength', strength);
    nextCombat = {
      ...nextCombat,
      player: statusResult.target,
      log: [...nextCombat.log, `失去生命触发 ${strength} 层力量。`],
    };
  }

  return nextCombat;
}

function exhaustFromHandByRule(
  combat: CombatState,
  effect: Extract<CardEffect, { type: 'exhaustFromHand' }>,
  drawOptions: DrawCardsOptions,
): CombatState {
  let candidates = combat.hand;
  if (effect.cardType) {
    candidates = candidates.filter((card) => getCardDefinitionForInstance(card).type === effect.cardType);
  }
  if (effect.excludeType) {
    candidates = candidates.filter((card) => getCardDefinitionForInstance(card).type !== effect.excludeType);
  }

  const amount = effect.amount === 'all' ? candidates.length : Math.min(effect.amount, candidates.length);
  let selected: CardInstance[] = [];
  let rngSeed = combat.rngSeed;
  let remainingCandidates = [...candidates];

  for (let index = 0; index < amount; index += 1) {
    if (remainingCandidates.length === 0) {
      break;
    }

    const selectedIndex = effect.random ? randomInt(rngSeed, remainingCandidates.length) : { value: 0, seed: rngSeed };
    rngSeed = selectedIndex.seed;
    const [card] = remainingCandidates.splice(selectedIndex.value, 1);
    selected = [...selected, card];
  }

  if (selected.length === 0) {
    return { ...combat, rngSeed };
  }

  const selectedIds = new Set(selected.map((card) => card.instanceId));
  let nextCombat: CombatState = {
    ...combat,
    rngSeed,
    hand: combat.hand.filter((card) => !selectedIds.has(card.instanceId)),
    exhaustPile: [...combat.exhaustPile, ...selected],
    log: [...combat.log, `消耗手牌 ${selected.length} 张。`],
  };

  nextCombat = recordExhaustedCards(nextCombat, selected, drawOptions);
  return nextCombat;
}

function playTopCards(
  combat: CombatState,
  count: number,
  exhaustPlayed: boolean,
  drawOptions: DrawCardsOptions,
): CombatState {
  let nextCombat = combat;
  for (let index = 0; index < count; index += 1) {
    const topCard = nextCombat.drawPile[0];
    if (!topCard) {
      break;
    }
    nextCombat = {
      ...nextCombat,
      drawPile: nextCombat.drawPile.slice(1),
    };
    nextCombat = playCardInstanceForFree(nextCombat, topCard, undefined, exhaustPlayed, drawOptions);
  }
  return nextCombat;
}

function playCardInstanceForFree(
  combat: CombatState,
  cardInstance: CardInstance,
  targetEnemyId?: string,
  forceExhaust = false,
  drawOptions: DrawCardsOptions = {},
): CombatState {
  const card = getCardDefinitionForInstance(cardInstance);
  const target = targetEnemyId ?? getRandomAliveEnemyId(combat);
  let nextCombat: CombatState = {
    ...combat,
    log: [...combat.log, `免费打出 ${card.name}。`],
  };
  nextCombat = resolveCardEffects(nextCombat, card, target, drawOptions, {
    playedCard: cardInstance,
    xValue: 0,
  });

  const shouldExhaust =
    card.type === 'power' ||
    forceExhaust ||
    Boolean(cardInstance.exhaustOnPlay) ||
    card.effects.some((effect) => effect.type === 'exhaustSelf');
  nextCombat = {
    ...nextCombat,
    discardPile: shouldExhaust ? nextCombat.discardPile : [...nextCombat.discardPile, cardInstance],
    exhaustPile: shouldExhaust ? [...nextCombat.exhaustPile, cardInstance] : nextCombat.exhaustPile,
    turnStats: {
      ...nextCombat.turnStats,
      cardsPlayed: nextCombat.turnStats.cardsPlayed + 1,
      attacksPlayed: card.type === 'attack' ? nextCombat.turnStats.attacksPlayed + 1 : nextCombat.turnStats.attacksPlayed,
      skillsPlayed: card.type === 'skill' ? nextCombat.turnStats.skillsPlayed + 1 : nextCombat.turnStats.skillsPlayed,
      powersPlayed: card.type === 'power' ? nextCombat.turnStats.powersPlayed + 1 : nextCombat.turnStats.powersPlayed,
    },
  };

  return shouldExhaust ? recordExhaustedCards(nextCombat, [cardInstance], drawOptions) : nextCombat;
}

function drawUntilCardType(
  combat: CombatState,
  cardType: CardType,
  invert: boolean,
  drawOptions: DrawCardsOptions,
): CombatState {
  let nextCombat = combat;
  let guard = 0;
  while (guard < 30) {
    guard += 1;
    const handSize = nextCombat.hand.length;
    nextCombat = drawCards(nextCombat, 1, drawOptions);
    if (nextCombat.hand.length === handSize) {
      break;
    }
    const drawn = nextCombat.hand[nextCombat.hand.length - 1];
    const drawnType = getCardDefinitionForInstance(drawn).type;
    if (invert ? drawnType !== cardType : drawnType === cardType) {
      break;
    }
  }
  return nextCombat;
}

function addRandomCardToHand(
  combat: CombatState,
  effect: Extract<CardEffect, { type: 'addRandomCardToHand' }>,
): CombatState {
  const candidates = rewardWarriorCards.filter((card) => !effect.cardType || card.type === effect.cardType);
  if (candidates.length === 0) {
    return combat;
  }

  const random = randomInt(combat.rngSeed, candidates.length);
  const definition = candidates[random.value];
  const instance: CardInstance = {
    definitionId: definition.id,
    upgraded: Boolean(effect.upgraded),
    costOverride: effect.costOverride,
    exhaustOnPlay: effect.exhaustOnPlay,
    instanceId: `generated-${combat.turn}-${random.seed}-${definition.id}`,
  };

  return {
    ...combat,
    rngSeed: random.seed,
    hand: [...combat.hand, instance],
    log: [...combat.log, `将 ${definition.name} 加入手牌。`],
  };
}

function gainTemporaryStrength(
  combat: CombatState,
  sourceName: string,
  amount: number,
  target: 'player' | 'enemy',
  targetEnemyId?: string,
): CombatState {
  if (target === 'player') {
    const withStrength = addStatus(combat.player, 'strength', amount).target;
    const withTemporary = addStatus(withStrength, 'temporaryStrength', amount).target;
    return {
      ...combat,
      player: withTemporary,
      log: [...combat.log, `${sourceName} 临时调整 ${amount} 层力量。`],
    };
  }

  return updateEnemy(combat, targetEnemyId ?? getFirstAliveEnemyId(combat), (enemy) => {
    const withStrength = addStatus(enemy, 'strength', amount).target;
    const withTemporary = addStatus(withStrength, 'temporaryStrength', amount).target;
    return {
      enemy: withTemporary,
      log: `${sourceName} 临时调整 ${enemy.name} ${amount} 层力量。`,
    };
  });
}

function recallRandomAttackFromDiscard(combat: CombatState): CombatState {
  const candidates = combat.discardPile.filter((card) => getCardDefinitionForInstance(card).type === 'attack');
  if (candidates.length === 0) {
    return combat;
  }

  const random = randomInt(combat.rngSeed, candidates.length);
  const selected = { ...candidates[random.value], upgraded: true };
  return {
    ...combat,
    rngSeed: random.seed,
    discardPile: combat.discardPile.filter((card) => card.instanceId !== candidates[random.value].instanceId),
    hand: [...combat.hand, selected],
    log: [...combat.log, `${getCardDefinitionForInstance(selected).name} 从弃牌堆回到手牌并升级。`],
  };
}

function autoPlayFromExhaust(combat: CombatState, timing: 'turnStart' | 'turnEnd'): CombatState {
  const candidates = combat.exhaustPile.filter((card) => {
    const definition = getCardDefinitionForInstance(card);
    return definition.effects.some((effect) => effect.type === 'autoPlayFromExhaust' && effect.timing === timing);
  });

  return candidates.reduce((nextCombat, card) => {
    const definition = getCardDefinitionForInstance(card);
    const target = definition.target === 'enemy' ? getRandomAliveEnemyId(nextCombat) : undefined;
    nextCombat = {
      ...nextCombat,
      log: [...nextCombat.log, `${definition.name} 从消耗堆自动打出。`],
    };
    return resolveCardEffects(nextCombat, definition, target, {}, { playedCard: card, xValue: 0 });
  }, combat);
}

function getPrimaryDamageAmount(effects: CardEffect[]): number {
  for (const effect of effects) {
    if (effect.type === 'damage' || effect.type === 'damageAll') {
      return effect.amount;
    }
    if (effect.type === 'damageRepeated' || effect.type === 'damageRandomEnemy' || effect.type === 'damageAllRepeated') {
      return effect.amount;
    }
    if (effect.type === 'conditional') {
      const nested = getPrimaryDamageAmount(effect.effects);
      if (nested > 0) {
        return nested;
      }
    }
  }

  return 0;
}

function isCardConditionMet(
  combat: CombatState,
  condition: CardCondition,
  targetEnemyId?: string,
): boolean {
  if (condition.type === 'playerHpAtOrBelowHalf') {
    return combat.player.hp <= Math.floor(combat.player.maxHp / 2);
  }

  if (condition.type === 'playerHasBlock') {
    return combat.player.block > 0;
  }

  if (condition.type === 'exhaustedCardThisTurn') {
    return combat.turnStats.cardsExhausted > 0;
  }

  if (condition.type === 'lostHpThisTurn') {
    return combat.turnStats.lostHpThisTurn;
  }

  if (condition.type === 'exhaustPileAtLeast') {
    return combat.exhaustPile.length >= condition.amount;
  }

  if (condition.type === 'targetHasStatus') {
    const target = combat.enemies.find(
      (enemy) => enemy.instanceId === targetEnemyId || (!targetEnemyId && isEnemyAlive(enemy)),
    );
    return Boolean(target && isEnemyAlive(target) && getStatus(target, condition.status) > 0);
  }

  return false;
}

function updateEnemy(
  combat: CombatState,
  targetEnemyId: string | undefined,
  update: (enemy: EnemyCombatantState) => {
    enemy: CombatantState;
    player?: CombatantState;
    log: string;
  },
): CombatState {
  if (!targetEnemyId) {
    return combat;
  }

  let logEntry: string | undefined;
  let player = combat.player;
  const enemies = combat.enemies.map((enemy) => {
    if (enemy.instanceId !== targetEnemyId) {
      return enemy;
    }

    if (!isEnemyAlive(enemy)) {
      return enemy;
    }

    const result = update(enemy);
    logEntry = result.log;
    player = result.player ?? player;
    return {
      ...enemy,
      ...result.enemy,
    };
  });

  return {
    ...combat,
    player,
    enemies,
    log: logEntry ? [...combat.log, logEntry] : combat.log,
  };
}

function setStatus(target: CombatantState, status: StatusId, amount: number): CombatantState {
  const statuses: StatusMap = { ...target.statuses };

  if (amount === 0) {
    delete statuses[status];
  } else {
    statuses[status] = amount;
  }

  return {
    ...target,
    statuses,
  };
}

export function statusLabel(status: StatusId): string {
  return statusDefinitions[status].label;
}

function cloneCardInstance(card: CardInstance, instanceId: string): CardInstance {
  return {
    ...card,
    instanceId,
  };
}

function getFirstAliveEnemyId(combat: CombatState): string | undefined {
  return combat.enemies.find(isEnemyAlive)?.instanceId;
}

function getRandomAliveEnemyId(combat: CombatState): string | undefined {
  const enemies = combat.enemies.filter(isEnemyAlive);
  if (enemies.length === 0) {
    return undefined;
  }

  const random = randomInt(combat.rngSeed, enemies.length);
  return enemies[random.value].instanceId;
}

function getTargetEnemy(combat: CombatState, targetEnemyId?: string): EnemyCombatantState | undefined {
  return combat.enemies.find((enemy) =>
    targetEnemyId ? enemy.instanceId === targetEnemyId : isEnemyAlive(enemy),
  );
}

function isBasicAttackLike(card: CardInstance): boolean {
  const definition = getCardDefinitionForInstance(card);
  return (
    card.definitionId === 'short-blade-advance' ||
    definition.name.includes('Strike') ||
    definition.name.includes('打击') ||
    definition.lowProfileName.includes('基础')
  );
}

function countBasicAttackCards(combat: CombatState, playedCard?: CardInstance): number {
  return [
    ...combat.drawPile,
    ...combat.hand,
    ...combat.discardPile,
    ...combat.exhaustPile,
    ...(playedCard ? [playedCard] : []),
  ].filter(isBasicAttackLike).length;
}

function isEnemyAlive(enemy: EnemyCombatantState): boolean {
  return enemy.hp > 0 && !enemy.defeated;
}
