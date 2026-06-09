import { relicById } from '../data/relics/relics';
import type {
  CardDefinition,
  CombatState,
  RelicEffect,
  RelicHook,
  RelicTriggerCondition,
} from '../types';
import { drawCards } from './deck';
import { addBlock, addStatus, healHp, statusLabel } from './effects';

export interface RelicTriggerContext {
  card?: CardDefinition;
  enemyId?: string;
}

export function resolveRelicTriggers(
  combat: CombatState,
  hook: RelicHook,
  context: RelicTriggerContext = {},
): CombatState {
  return combat.relics.reduce((nextCombat, relicId) => {
    const relic = relicById[relicId];
    if (!relic) {
      return nextCombat;
    }

    return relic.triggers
      .filter((trigger) => trigger.hook === hook)
      .reduce((triggeredCombat, trigger) => {
        if (trigger.condition && !isConditionMet(triggeredCombat, trigger.condition, context)) {
          return triggeredCombat;
        }

        return trigger.effects.reduce(
          (effectCombat, effect) => applyRelicEffect(effectCombat, relic.name, effect),
          triggeredCombat,
        );
      }, nextCombat);
  }, combat);
}

function isConditionMet(
  combat: CombatState,
  condition: RelicTriggerCondition,
  context: RelicTriggerContext,
): boolean {
  if (condition.type === 'turnEquals') {
    return combat.turn === condition.value;
  }

  if (condition.type === 'firstSkillThisTurn') {
    return context.card?.type === 'skill' && combat.turnStats.skillsPlayed === 1;
  }

  return false;
}

function applyRelicEffect(
  combat: CombatState,
  relicName: string,
  effect: RelicEffect,
): CombatState {
  if (effect.type === 'applyStatus') {
    const result = addStatus(combat.player, effect.status, effect.amount);
    return {
      ...combat,
      player: result.target,
      log: [
        ...combat.log,
        result.prevented
          ? `${relicName} 的状态被抵消。`
          : `${relicName} 使铁誓者获得 ${effect.amount} 层${statusLabel(effect.status)}。`,
      ],
    };
  }

  if (effect.type === 'block') {
    const player = addBlock(combat.player, effect.amount);
    return {
      ...combat,
      player,
      log: [...combat.log, `${relicName} 提供 ${player.block - combat.player.block} 点格挡。`],
    };
  }

  if (effect.type === 'draw') {
    return drawCards(combat, effect.amount, {
      onShuffle: (nextCombat) => resolveRelicTriggers(nextCombat, 'onShuffle'),
    });
  }

  if (effect.type === 'gainEnergy') {
    return {
      ...combat,
      energy: combat.energy + effect.amount,
      log: [...combat.log, `${relicName} 提供 ${effect.amount} 点能量。`],
    };
  }

  if (effect.type === 'heal') {
    const result = healHp(combat.player, effect.amount);
    return {
      ...combat,
      player: result.target,
      log: [...combat.log, `${relicName} 回复 ${result.healed} 点生命。`],
    };
  }

  return combat;
}
