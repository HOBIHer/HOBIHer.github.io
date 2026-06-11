import { rewardWarriorCards } from '../data/cards/warrior';
import { potionById, potions } from '../data/potions/potions';
import { randomInt, shuffle } from '../rng';
import type {
  CardInstance,
  CardType,
  CombatState,
  CombatantState,
  EnemyCombatantState,
  PotionEffect,
  PotionId,
  PotionInstance,
  RunState,
  StatusId,
} from '../types';
import {
  addBlock,
  addStatus,
  applyReplayToMatchingCards,
  applyDrawnCardTriggers,
  dealDamage,
  healHp,
  playCardInstanceForFree,
  statusLabel,
} from './effects';
import { drawCards, type DrawCardsOptions } from './deck';
import { resolveRelicTriggers } from './relics';

export function createPotionInstance(definitionId: PotionId, prefix: string): PotionInstance {
  return {
    definitionId,
    instanceId: `${prefix}-${definitionId}`,
  };
}

export function pickPotion(seed: number): PotionId | undefined {
  const pool = potions.filter((potion) => potion.rarity !== 'event' && potion.rarity !== 'token');
  if (pool.length === 0) {
    return undefined;
  }

  return pool[Math.abs(seed) % pool.length].id;
}

export function usePotion(
  run: RunState,
  combat: CombatState | undefined,
  potionInstanceId: string,
  targetEnemyId?: string,
): { run: RunState; combat?: CombatState } {
  if (run.currentScreen !== 'combat' || !combat || combat.phase !== 'player') {
    return { run, combat };
  }

  const potion = run.potions.find((candidate) => candidate.instanceId === potionInstanceId);
  if (!potion) {
    return { run, combat };
  }

  const definition = potionById[potion.definitionId];
  if (!definition) {
    return { run, combat };
  }

  if (definition.effects.every((effect) => effect.type === 'deathWard')) {
    return {
      run,
      combat: {
        ...combat,
        log: [...combat.log, `${definition.name} 会在生命归零时自动触发。`],
      },
    };
  }

  const targetId =
    definition.target === 'enemy'
      ? targetEnemyId ?? combat.enemies.find((enemy) => isEnemyAlive(enemy))?.instanceId
      : undefined;
  const hasValidTarget =
    definition.target !== 'enemy' ||
    combat.enemies.some((enemy) => enemy.instanceId === targetId && isEnemyAlive(enemy));

  if (definition.target === 'enemy' && (!targetId || !hasValidTarget)) {
    return {
      run,
      combat: {
        ...combat,
        log: [...combat.log, `${definition.name} 没有可用目标。`],
      },
    };
  }

  let nextRun: RunState = {
    ...run,
    potions: run.potions.filter((candidate) => candidate.instanceId !== potionInstanceId),
  };
  let nextCombat: CombatState = {
    ...combat,
    log: [...combat.log, `使用 ${definition.name}。`],
  };

  for (const effect of definition.effects) {
    const resolved = resolvePotionEffect(nextRun, nextCombat, definition.name, effect, targetId);
    nextRun = resolved.run;
    nextCombat = resolved.combat;
  }

  nextCombat = finalizePotionCombat(nextCombat);
  nextRun = {
    ...nextRun,
    currentCombat: nextCombat,
  };

  return { run: nextRun, combat: nextCombat };
}

export function triggerDeathWardPotion(
  run: RunState,
  combat: CombatState,
): { run: RunState; combat: CombatState; triggered: boolean } {
  if (combat.player.hp > 0) {
    return { run, combat, triggered: false };
  }

  const potion = run.potions.find((candidate) =>
    potionById[candidate.definitionId]?.effects.some((effect) => effect.type === 'deathWard'),
  );
  if (!potion) {
    return { run, combat, triggered: false };
  }

  const definition = potionById[potion.definitionId];
  const effect = definition.effects.find((candidate) => candidate.type === 'deathWard') as
    | Extract<PotionEffect, { type: 'deathWard' }>
    | undefined;
  if (!effect) {
    return { run, combat, triggered: false };
  }

  const targetHp = Math.max(1, Math.floor(combat.player.maxHp * effect.healPercent));
  const nextCombat: CombatState = {
    ...combat,
    phase: 'player',
    player: {
      ...combat.player,
      hp: Math.min(combat.player.maxHp, targetHp),
    },
    log: [...combat.log, `${definition.name} 被丢弃，生命恢复到 ${targetHp}。`],
  };

  return {
    run: {
      ...run,
      potions: run.potions.filter((candidate) => candidate.instanceId !== potion.instanceId),
      currentCombat: nextCombat,
    },
    combat: nextCombat,
    triggered: true,
  };
}

function resolvePotionEffect(
  run: RunState,
  combat: CombatState,
  sourceName: string,
  effect: PotionEffect,
  targetEnemyId?: string,
): { run: RunState; combat: CombatState } {
  if (effect.type === 'heal') {
    const result = healHp(combat.player, effect.amount);
    return {
      run,
      combat: {
        ...combat,
        player: result.target,
        log: [...combat.log, `${sourceName} 回复 ${result.healed} 点生命。`],
      },
    };
  }

  if (effect.type === 'healPercentMaxHp') {
    const amount = Math.floor(combat.player.maxHp * effect.percent);
    const result = healHp(combat.player, amount);
    return {
      run,
      combat: {
        ...combat,
        player: result.target,
        log: [...combat.log, `${sourceName} 回复 ${result.healed} 点生命。`],
      },
    };
  }

  if (effect.type === 'block') {
    const player = addBlock(combat.player, effect.amount);
    return {
      run,
      combat: {
        ...combat,
        player,
        log: [...combat.log, `${sourceName} 提供 ${player.block - combat.player.block} 点格挡。`],
      },
    };
  }

  if (effect.type === 'multiplyBlock') {
    const nextBlock = combat.player.block * effect.multiplier;
    return {
      run,
      combat: {
        ...combat,
        player: { ...combat.player, block: nextBlock },
        log: [...combat.log, `${sourceName} 将格挡调整为 ${nextBlock}。`],
      },
    };
  }

  if (effect.type === 'draw') {
    return { run, combat: drawCards(combat, effect.amount, createPotionDrawOptions()) };
  }

  if (effect.type === 'gainEnergy') {
    return {
      run,
      combat: {
        ...combat,
        energy: combat.energy + effect.amount,
        log: [...combat.log, `${sourceName} 提供 ${effect.amount} 点能量。`],
      },
    };
  }

  if (effect.type === 'gainMaxHp') {
    return {
      run: {
        ...run,
        character: {
          ...run.character,
          hp: run.character.hp + effect.amount,
          maxHp: run.character.maxHp + effect.amount,
        },
      },
      combat: {
        ...combat,
        player: {
          ...combat.player,
          hp: combat.player.hp + effect.amount,
          maxHp: combat.player.maxHp + effect.amount,
        },
        log: [...combat.log, `${sourceName} 使最大生命提高 ${effect.amount}。`],
      },
    };
  }

  if (effect.type === 'damage') {
    return {
      run,
      combat:
        effect.target === 'allEnemies'
          ? damageAllEnemies(combat, effect.amount, sourceName)
          : damageEnemy(combat, targetEnemyId ?? getFirstAliveEnemyId(combat), effect.amount, sourceName),
    };
  }

  if (effect.type === 'applyStatus') {
    if (effect.target === 'player') {
      const result = addStatus(combat.player, effect.status, effect.amount);
      return {
        run,
        combat: {
          ...combat,
          player: result.target,
          log: [...combat.log, `${sourceName} 获得 ${effect.amount} 层${statusLabel(effect.status)}。`],
        },
      };
    }

    return {
      run,
      combat: applyStatusToEnemy(
        combat,
        targetEnemyId ?? getFirstAliveEnemyId(combat),
        effect.status,
        effect.amount,
        sourceName,
      ),
    };
  }

  if (effect.type === 'applyStatusAll') {
    return {
      run,
      combat: combat.enemies.reduce(
        (nextCombat, enemy) =>
          isEnemyAlive(enemy)
            ? applyStatusToEnemy(nextCombat, enemy.instanceId, effect.status, effect.amount, sourceName)
            : nextCombat,
        combat,
      ),
    };
  }

  if (effect.type === 'gainTemporaryStatus') {
    return {
      run,
      combat: applyTemporaryStatus(combat, effect.status, effect.amount, effect.target, sourceName, targetEnemyId),
    };
  }

  if (effect.type === 'upgradeHand') {
    const hand = combat.hand.map((card) => ({ ...card, upgraded: true }));
    return {
      run,
      combat: {
        ...combat,
        hand,
        log: [...combat.log, `${sourceName} 升级手牌 ${hand.length} 张。`],
      },
    };
  }

  if (effect.type === 'shuffleAllIntoDrawAndDraw') {
    const allCards = [...combat.hand, ...combat.drawPile, ...combat.discardPile];
    const shuffled = shuffle(allCards, combat.rngSeed);
    const shuffledCombat: CombatState = {
      ...combat,
      rngSeed: shuffled.seed,
      hand: [],
      drawPile: shuffled.items,
      discardPile: [],
      log: [...combat.log, `${sourceName} 重整所有未消耗牌。`],
    };
    return { run, combat: drawCards(shuffledCombat, effect.draw, createPotionDrawOptions()) };
  }

  if (effect.type === 'playTopCards') {
    let nextCombat = combat;
    for (let index = 0; index < effect.count; index += 1) {
      const topCard = nextCombat.drawPile[0];
      if (!topCard) {
        break;
      }
      nextCombat = {
        ...nextCombat,
        drawPile: nextCombat.drawPile.slice(1),
      };
      nextCombat = playCardInstanceForFree(nextCombat, topCard, undefined, false, createPotionDrawOptions());
    }
    return { run, combat: nextCombat };
  }

  if (effect.type === 'fillPotionSlots') {
    let nextRun = run;
    let rngSeed = combat.rngSeed;
    while (nextRun.potions.length < nextRun.potionSlots) {
      const picked = pickPotion(rngSeed);
      if (!picked) {
        break;
      }
      const random = randomInt(rngSeed, Math.max(1, potions.length));
      rngSeed = random.seed;
      nextRun = {
        ...nextRun,
        potions: [
          ...nextRun.potions,
          createPotionInstance(picked, `${nextRun.id}-filled-${nextRun.potions.length}-${rngSeed}`),
        ],
      };
    }

    return {
      run: nextRun,
      combat: {
        ...combat,
        rngSeed,
        log: [...combat.log, `${sourceName} 填满空药水栏位。`],
      },
    };
  }

  if (effect.type === 'deathWard') {
    return { run, combat };
  }

  if (effect.type === 'moveDiscardToHand') {
    return { run, combat: moveDiscardToHand(combat, effect, sourceName) };
  }

  if (effect.type === 'addRandomCardsToHand') {
    return { run, combat: addRandomCardsToHand(combat, effect, sourceName) };
  }

  if (effect.type === 'randomizeHandCostsThisTurn') {
    let rngSeed = combat.rngSeed;
    const hand = combat.hand.map((card) => {
      const random = randomInt(rngSeed, 4);
      rngSeed = random.seed;
      return { ...card, costOverride: random.value };
    });

    return {
      run,
      combat: {
        ...combat,
        rngSeed,
        hand,
        log: [...combat.log, `${sourceName} 随机化手牌费用。`],
      },
    };
  }

  if (effect.type === 'retainHand') {
    return {
      run,
      combat: {
        ...combat,
        player: addStatus(combat.player, 'retainHand', effect.turns).target,
        log: [...combat.log, `${sourceName} 保留手牌 ${effect.turns} 回合。`],
      },
    };
  }

  if (effect.type === 'applyReplayToCardsByName') {
    return {
      run,
      combat: applyReplayToMatchingCards(combat, effect.nameIncludes, effect.amount, sourceName),
    };
  }

  return { run, combat };
}

function damageEnemy(
  combat: CombatState,
  targetEnemyId: string | undefined,
  amount: number,
  sourceName: string,
): CombatState {
  if (!targetEnemyId) {
    return combat;
  }

  return updateEnemy(combat, targetEnemyId, (enemy) => {
    const result = dealDamage(enemy, amount);
    return {
      enemy: result.target,
      log: `${sourceName} 对 ${enemy.name} 造成 ${amount} 点伤害，${result.blocked} 点被格挡。`,
    };
  });
}

function damageAllEnemies(combat: CombatState, amount: number, sourceName: string): CombatState {
  return combat.enemies.reduce(
    (nextCombat, enemy) => (isEnemyAlive(enemy) ? damageEnemy(nextCombat, enemy.instanceId, amount, sourceName) : nextCombat),
    combat,
  );
}

function applyStatusToEnemy(
  combat: CombatState,
  targetEnemyId: string | undefined,
  status: StatusId,
  amount: number,
  sourceName: string,
): CombatState {
  if (!targetEnemyId) {
    return combat;
  }

  return updateEnemy(combat, targetEnemyId, (enemy) => {
    const result = addStatus(enemy, status, amount);
    return {
      enemy: result.target,
      log: result.prevented
        ? `${sourceName} 对 ${enemy.name} 的状态被抵消。`
        : `${sourceName} 对 ${enemy.name} 施加 ${amount} 层${statusLabel(status)}。`,
    };
  });
}

function applyTemporaryStatus(
  combat: CombatState,
  status: 'strength' | 'dexterity',
  amount: number,
  target: 'player' | 'enemy' | 'allEnemies',
  sourceName: string,
  targetEnemyId?: string,
): CombatState {
  const temporaryStatus = status === 'strength' ? 'temporaryStrength' : 'temporaryDexterity';
  const apply = (combatant: CombatantState) =>
    addStatus(addStatus(combatant, status, amount).target, temporaryStatus, amount).target;

  if (target === 'player') {
    return {
      ...combat,
      player: apply(combat.player),
      log: [...combat.log, `${sourceName} 临时调整 ${amount} 层${statusLabel(status)}。`],
    };
  }

  if (target === 'allEnemies') {
    return combat.enemies.reduce(
      (nextCombat, enemy) =>
        isEnemyAlive(enemy)
          ? updateEnemy(nextCombat, enemy.instanceId, (targetEnemy) => ({
              enemy: apply(targetEnemy),
              log: `${sourceName} 临时调整 ${targetEnemy.name} ${amount} 层${statusLabel(status)}。`,
            }))
          : nextCombat,
      combat,
    );
  }

  const enemyId = targetEnemyId ?? getFirstAliveEnemyId(combat);
  if (!enemyId) {
    return combat;
  }

  return updateEnemy(combat, enemyId, (enemy) => ({
    enemy: apply(enemy),
    log: `${sourceName} 临时调整 ${enemy.name} ${amount} 层${statusLabel(status)}。`,
  }));
}

function moveDiscardToHand(
  combat: CombatState,
  effect: Extract<PotionEffect, { type: 'moveDiscardToHand' }>,
  sourceName: string,
): CombatState {
  if (combat.discardPile.length === 0 || combat.hand.length >= 10) {
    return combat;
  }

  let rngSeed = combat.rngSeed;
  let discardPile = [...combat.discardPile];
  const moved: CardInstance[] = [];
  const amount = Math.min(effect.amount, discardPile.length, 10 - combat.hand.length);

  for (let index = 0; index < amount; index += 1) {
    const selectedIndex = effect.random ? randomInt(rngSeed, discardPile.length) : { value: 0, seed: rngSeed };
    rngSeed = selectedIndex.seed;
    const [card] = discardPile.splice(selectedIndex.value, 1);
    moved.push({ ...card, costOverride: effect.costOverride ?? card.costOverride });
  }

  return {
    ...combat,
    rngSeed,
    discardPile,
    hand: [...combat.hand, ...moved],
    log: [...combat.log, `${sourceName} 从弃牌堆取回 ${moved.length} 张牌。`],
  };
}

function addRandomCardsToHand(
  combat: CombatState,
  effect: Extract<PotionEffect, { type: 'addRandomCardsToHand' }>,
  sourceName: string,
): CombatState {
  let nextCombat = combat;

  for (const cardType of effect.cardTypes) {
    if (nextCombat.hand.length >= 10) {
      break;
    }

    const candidates = getRewardCardsByType(cardType);
    if (candidates.length === 0) {
      continue;
    }

    const random = randomInt(nextCombat.rngSeed, candidates.length);
    const definition = candidates[random.value];
    const instance: CardInstance = {
      definitionId: definition.id,
      upgraded: Boolean(effect.upgraded),
      costOverride: effect.costOverride,
      exhaustOnPlay: effect.exhaustOnPlay,
      instanceId: `potion-${nextCombat.turn}-${random.seed}-${definition.id}`,
    };

    nextCombat = {
      ...nextCombat,
      rngSeed: random.seed,
      hand: [...nextCombat.hand, instance],
      log: [...nextCombat.log, `${sourceName} 将 ${definition.name} 加入手牌。`],
    };
  }

  return nextCombat;
}

function finalizePotionCombat(combat: CombatState): CombatState {
  if (combat.player.hp <= 0) {
    return {
      ...combat,
      phase: 'lost',
      log: [...combat.log, `${combat.player.name} 倒下了。`],
    };
  }

  if (combat.enemies.every((enemy) => enemy.defeated || enemy.hp <= 0)) {
    const defeatedEnemies = combat.enemies.map((enemy) =>
      enemy.hp <= 0 ? { ...enemy, hp: 0, defeated: true } : enemy,
    );
    return resolveRelicTriggers(
      {
        ...combat,
        enemies: defeatedEnemies,
        phase: 'won',
        log: [...combat.log, '战斗胜利。'],
      },
      'onVictory',
    );
  }

  return combat;
}

function updateEnemy(
  combat: CombatState,
  targetEnemyId: string,
  update: (enemy: EnemyCombatantState) => { enemy: CombatantState; log: string },
): CombatState {
  let logEntry: string | undefined;
  const enemies = combat.enemies.map((enemy) => {
    if (enemy.instanceId !== targetEnemyId || !isEnemyAlive(enemy)) {
      return enemy;
    }

    const result = update(enemy);
    logEntry = result.log;
    return {
      ...enemy,
      ...result.enemy,
    };
  });

  return {
    ...combat,
    enemies,
    log: logEntry ? [...combat.log, logEntry] : combat.log,
  };
}

function createPotionDrawOptions(): DrawCardsOptions {
  return {
    onShuffle: (combat) => resolveRelicTriggers(combat, 'onShuffle'),
    onCardDrawn: applyDrawnCardTriggers,
  };
}

function getRewardCardsByType(cardType: CardType) {
  return rewardWarriorCards.filter((card) => card.type === cardType);
}

function getFirstAliveEnemyId(combat: CombatState): string | undefined {
  return combat.enemies.find(isEnemyAlive)?.instanceId;
}

function isEnemyAlive(enemy: EnemyCombatantState): boolean {
  return enemy.hp > 0 && !enemy.defeated;
}
