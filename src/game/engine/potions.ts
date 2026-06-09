import { potionById, potions } from '../data/potions/potions';
import type { CombatState, PotionId, PotionInstance, RunState } from '../types';
import { addBlock, addStatus, healHp, statusLabel } from './effects';
import { drawCards } from './deck';

export function createPotionInstance(definitionId: PotionId, prefix: string): PotionInstance {
  return {
    definitionId,
    instanceId: `${prefix}-${definitionId}`,
  };
}

export function pickPotion(seed: number): PotionId | undefined {
  if (potions.length === 0) {
    return undefined;
  }

  return potions[Math.abs(seed) % potions.length].id;
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

  const targetId =
    definition.target === 'enemy'
      ? targetEnemyId ?? combat.enemies.find((enemy) => enemy.hp > 0 && !enemy.defeated)?.instanceId
      : undefined;

  const hasValidTarget =
    definition.target !== 'enemy' ||
    combat.enemies.some((enemy) => enemy.instanceId === targetId && enemy.hp > 0 && !enemy.defeated);

  if (definition.target === 'enemy' && (!targetId || !hasValidTarget)) {
    return {
      run,
      combat: {
        ...combat,
        log: [...combat.log, `${definition.name} 没有可用目标。`],
      },
    };
  }

  let nextCombat: CombatState = {
    ...combat,
    log: [...combat.log, `使用 ${definition.name}。`],
  };

  for (const effect of definition.effects) {
    if (effect.type === 'heal') {
      const result = healHp(nextCombat.player, effect.amount);
      nextCombat = {
        ...nextCombat,
        player: result.target,
        log: [...nextCombat.log, `${definition.name} 回复 ${result.healed} 点生命。`],
      };
    }

    if (effect.type === 'block') {
      const player = addBlock(nextCombat.player, effect.amount);
      nextCombat = {
        ...nextCombat,
        player,
        log: [...nextCombat.log, `${definition.name} 提供 ${player.block - nextCombat.player.block} 点格挡。`],
      };
    }

    if (effect.type === 'draw') {
      nextCombat = drawCards(nextCombat, effect.amount);
    }

    if (effect.type === 'applyStatus') {
      if (effect.target === 'player') {
        const result = addStatus(nextCombat.player, effect.status, effect.amount);
        nextCombat = {
          ...nextCombat,
          player: result.target,
          log: [
            ...nextCombat.log,
            result.prevented
              ? `${definition.name} 的状态被抵消。`
              : `${definition.name} 使铁誓者获得 ${effect.amount} 层${statusLabel(effect.status)}。`,
          ],
        };
      } else {
        let logEntry: string | undefined;
        const enemies = nextCombat.enemies.map((enemy) => {
          if (enemy.instanceId !== targetId || enemy.hp <= 0 || enemy.defeated) {
            return enemy;
          }

          const result = addStatus(enemy, effect.status, effect.amount);
          logEntry = result.prevented
            ? `${definition.name} 对 ${enemy.name} 的状态被抵消。`
            : `${definition.name} 对 ${enemy.name} 施加 ${effect.amount} 层${statusLabel(effect.status)}。`;
            return {
              ...enemy,
              ...result.target,
            };
        });

        nextCombat = {
          ...nextCombat,
          enemies,
          log: logEntry ? [...nextCombat.log, logEntry] : nextCombat.log,
        };
      }
    }
  }

  const nextRun = {
    ...run,
    potions: run.potions.filter((candidate) => candidate.instanceId !== potionInstanceId),
    currentCombat: nextCombat,
  };

  return { run: nextRun, combat: nextCombat };
}
