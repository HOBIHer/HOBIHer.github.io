import { warriorCardById } from '../data/cards/warrior';
import { statusDefinitions } from '../data/statuses/statuses';
import type {
  CardDefinition,
  CardCondition,
  CardEffect,
  CombatState,
  CombatantState,
  EnemyCombatantState,
  EnemyEffect,
  StatusDecayTiming,
  StatusId,
  StatusMap,
} from '../types';
import { discardFromHand, drawCards, type DrawCardsOptions } from './deck';

export function getCardDefinition(cardId: string): CardDefinition {
  const card = warriorCardById[cardId];
  if (!card) {
    throw new Error(`Unknown card id: ${cardId}`);
  }
  return card;
}

export function getStatus(combatant: CombatantState, status: StatusId): number {
  return combatant.statuses[status] ?? 0;
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
    getStatus(target, 'barrierLock') > 0 &&
    Boolean(statusDefinitions.barrierLock.preservesBlockAtTurnStart);

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
): CombatState {
  return card.effects.reduce((nextCombat, effect) => {
    if (effect.type === 'exhaustSelf') {
      return nextCombat;
    }

    return resolveCardEffect(nextCombat, card, effect, targetEnemyId, drawOptions);
  }, combat);
}

function resolveCardEffect(
  combat: CombatState,
  card: CardDefinition,
  effect: Exclude<CardEffect, { type: 'exhaustSelf' }>,
  targetEnemyId?: string,
  drawOptions: DrawCardsOptions = {},
): CombatState {
  if (effect.type === 'draw') {
    return drawCards(combat, effect.amount, drawOptions);
  }

  if (effect.type === 'discard') {
    return discardFromHand(combat, effect.amount);
  }

  if (effect.type === 'gainEnergy') {
    return {
      ...combat,
      energy: combat.energy + effect.amount,
      log: [...combat.log, `${card.name} 提供 ${effect.amount} 点能量。`],
    };
  }

  if (effect.type === 'loseHp') {
    const result = loseHp(combat.player, effect.amount);
    return {
      ...combat,
      player: result.target,
      log: [...combat.log, `${card.name} 使铁誓者失去 ${result.hpLoss} 点生命。`],
    };
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
    const player = addBlock(combat.player, effect.amount);
    const gained = player.block - combat.player.block;
    return {
      ...combat,
      player,
      log: [...combat.log, `${card.name} 提供 ${gained} 点格挡。`],
    };
  }

  if (effect.type === 'blockNextTurn') {
    const blockedPlayer = addBlock(combat.player, effect.amount);
    const result = addStatus(blockedPlayer, 'barrierLock', 1);
    return {
      ...combat,
      player: result.target,
      log: [
        ...combat.log,
        `${card.name} 预留 ${blockedPlayer.block - combat.player.block} 点下回合格挡。`,
      ],
    };
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
            ? `${card.name} 的状态被抵消。`
            : `${card.name} 使铁誓者获得 ${effect.amount} 层${statusLabel(effect.status)}。`,
        ],
      };
    }

    const targetId = targetEnemyId ?? combat.enemies.find(isEnemyAlive)?.instanceId;
    return updateEnemy(combat, targetId, (enemy) => {
      const result = addStatus(enemy, effect.status, effect.amount);
      return {
        enemy: result.target,
        log: result.prevented
          ? `${card.name} 对 ${enemy.name} 的状态被抵消。`
          : `${card.name} 对 ${enemy.name} 施加 ${effect.amount} 层${statusLabel(effect.status)}。`,
      };
    });
  }

  if (effect.type === 'damage') {
    if (effect.target === 'allEnemies') {
      return combat.enemies.reduce((nextCombat, enemy) => {
        if (!isEnemyAlive(enemy)) {
          return nextCombat;
        }
        return damageEnemy(nextCombat, card, enemy.instanceId, effect.amount);
      }, combat);
    }

    const targetId = targetEnemyId ?? combat.enemies.find(isEnemyAlive)?.instanceId;
    return damageEnemy(combat, card, targetId, effect.amount);
  }

  if (effect.type === 'damageAll') {
    return combat.enemies.reduce((nextCombat, enemy) => {
      if (!isEnemyAlive(enemy)) {
        return nextCombat;
      }
      return damageEnemy(nextCombat, card, enemy.instanceId, effect.amount);
    }, combat);
  }

  if (effect.type === 'conditional') {
    const conditionMet = isCardConditionMet(combat, effect.condition, targetEnemyId);
    const branchEffects = conditionMet ? effect.effects : effect.elseEffects ?? [];
    return branchEffects.reduce((nextCombat, branchEffect) => {
      if (branchEffect.type === 'exhaustSelf') {
        return nextCombat;
      }

      return resolveCardEffect(nextCombat, card, branchEffect, targetEnemyId, drawOptions);
    }, combat);
  }

  return combat;
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

  if (condition.type === 'targetHasStatus') {
    const target = combat.enemies.find(
      (enemy) => enemy.instanceId === targetEnemyId || (!targetEnemyId && isEnemyAlive(enemy)),
    );
    return Boolean(target && isEnemyAlive(target) && getStatus(target, condition.status) > 0);
  }

  return false;
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
    const amount = calculateAttackDamage(effect.amount, actingEnemy, combat.player);
    const result = dealDamage(combat.player, amount);
    let nextCombat: CombatState = {
      ...combat,
      player: result.target,
      log: [
        ...combat.log,
        `${actingEnemy.name} 造成 ${amount} 点伤害，${result.blocked} 点被格挡。`,
      ],
    };

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

export function statusLabel(status: StatusId): string {
  return statusDefinitions[status].label;
}

function isEnemyAlive(enemy: EnemyCombatantState): boolean {
  return enemy.hp > 0 && !enemy.defeated;
}
