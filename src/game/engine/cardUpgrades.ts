import { warriorCardById } from '../data/cards/warrior';
import { statusDefinitions } from '../data/statuses/statuses';
import type { CardCost, CardDefinition, CardEffect, CardInstance, CardType, StatusId } from '../types';

export function getBaseCardDefinition(cardId: string): CardDefinition {
  const card = warriorCardById[cardId];
  if (!card) {
    throw new Error(`Unknown card id: ${cardId}`);
  }

  return card;
}

export function getEffectiveCardDefinition(card: CardInstance | string): CardDefinition {
  const definitionId = typeof card === 'string' ? card : card.definitionId;
  const upgraded = typeof card === 'string' ? false : card.upgraded;
  const baseCard = getBaseCardDefinition(definitionId);
  const definition = upgraded ? createUpgradedCardDefinition(baseCard) : baseCard;
  if (typeof card === 'string') {
    return definition;
  }

  const withCostOverride =
    typeof card.costOverride === 'number' ? { ...definition, cost: card.costOverride } : definition;
  return typeof card.damageBonus === 'number' && card.damageBonus !== 0
    ? { ...withCostOverride, effects: addDamageBonus(withCostOverride.effects, card.damageBonus) }
    : withCostOverride;
}

export function createUpgradedCardDefinition(card: CardDefinition): CardDefinition {
  const effects = card.upgrade?.effects ?? upgradeEffects(card.effects, card.type);
  const cost = normalizeCost(card.upgrade?.cost ?? card.cost);

  return {
    ...card,
    id: `${card.id}+`,
    name: `${card.name}+`,
    lowProfileName: `${card.lowProfileName}+`,
    cost,
    description: card.upgrade?.description ?? describeEffects(effects, 'normal'),
    lowProfileDescription: card.upgrade?.lowProfileDescription ?? describeEffects(effects, 'stealth'),
    effects,
    innate: card.upgrade?.innate ?? card.innate,
  };
}

export function canUpgradeCardInstance(card: CardInstance): boolean {
  return !card.upgraded && Boolean(warriorCardById[card.definitionId]);
}

export function upgradeCardInstance(card: CardInstance): CardInstance {
  return canUpgradeCardInstance(card) ? { ...card, upgraded: true } : card;
}

function upgradeEffects(effects: CardEffect[], cardType: CardType): CardEffect[] {
  const primaryIndex = findPrimaryUpgradeIndex(effects, cardType);

  return effects.map((effect, index) =>
    index === primaryIndex ? upgradeEffect(effect, cardType) : cloneNestedEffect(effect),
  );
}

function findPrimaryUpgradeIndex(effects: CardEffect[], cardType: CardType): number {
  const preferredTypes =
    cardType === 'attack'
      ? ['damage', 'damageAll']
      : cardType === 'skill'
        ? ['block', 'blockNextTurn', 'heal', 'draw', 'gainEnergy', 'applyStatus']
        : ['applyStatus', 'draw', 'gainEnergy'];

  const index = effects.findIndex((effect) => preferredTypes.includes(effect.type));
  return index >= 0 ? index : effects.findIndex((effect) => effect.type !== 'exhaustSelf');
}

function upgradeEffect(effect: CardEffect, cardType: CardType): CardEffect {
  if (effect.type === 'damage') {
    return { ...effect, amount: effect.amount + (cardType === 'attack' ? 3 : 2) };
  }

  if (effect.type === 'damageAll') {
    return { ...effect, amount: effect.amount + 2 };
  }

  if (effect.type === 'damageRepeated' || effect.type === 'damageRandomEnemy') {
    return { ...effect, amount: effect.amount + (cardType === 'attack' ? 2 : 1) };
  }

  if (effect.type === 'damageAllRepeated') {
    return { ...effect, amount: effect.amount + 2 };
  }

  if (effect.type === 'block' || effect.type === 'blockNextTurn') {
    return { ...effect, amount: effect.amount + 3 };
  }

  if (effect.type === 'heal') {
    return { ...effect, amount: effect.amount + 2 };
  }

  if (effect.type === 'draw' || effect.type === 'gainEnergy') {
    return { ...effect, amount: effect.amount + 1 };
  }

  if (effect.type === 'applyStatus') {
    return { ...effect, amount: effect.amount + 1 };
  }

  if (effect.type === 'conditional') {
    return {
      ...effect,
      effects: upgradeEffects(effect.effects, cardType),
      elseEffects: effect.elseEffects ? upgradeEffects(effect.elseEffects, cardType) : undefined,
    };
  }

  return cloneNestedEffect(effect);
}

function normalizeCost(cost: CardCost): CardCost {
  return cost === 'X' ? 'X' : Math.max(0, cost);
}

function addDamageBonus(effects: CardEffect[], bonus: number): CardEffect[] {
  return effects.map((effect) => {
    if (effect.type === 'damage' || effect.type === 'damageAll') {
      return { ...effect, amount: effect.amount + bonus };
    }

    if (
      effect.type === 'damageRepeated' ||
      effect.type === 'damageRandomEnemy' ||
      effect.type === 'damageAllRepeated'
    ) {
      return { ...effect, amount: effect.amount + bonus };
    }

    if (effect.type === 'conditional') {
      return {
        ...effect,
        effects: addDamageBonus(effect.effects, bonus),
        elseEffects: effect.elseEffects ? addDamageBonus(effect.elseEffects, bonus) : undefined,
      };
    }

    return { ...effect };
  });
}

function cloneNestedEffect(effect: CardEffect): CardEffect {
  if (effect.type === 'conditional') {
    return {
      ...effect,
      effects: effect.effects.map(cloneNestedEffect),
      elseEffects: effect.elseEffects?.map(cloneNestedEffect),
    };
  }

  return { ...effect };
}

function describeEffects(effects: CardEffect[], mode: 'normal' | 'stealth'): string {
  return effects.map((effect) => describeEffect(effect, mode)).filter(Boolean).join('');
}

function describeEffect(effect: CardEffect, mode: 'normal' | 'stealth'): string {
  const hp = mode === 'stealth' ? '稳定度' : '生命';
  const block = mode === 'stealth' ? '缓冲' : '格挡';
  const energy = mode === 'stealth' ? '配额' : '能量';
  const card = mode === 'stealth' ? '操作项' : '牌';
  const progress = mode === 'stealth' ? '推进' : '造成';
  const target = mode === 'stealth' ? '目标' : '敌人';

  if (effect.type === 'damage') {
    return `${progress} ${effect.amount} 点${mode === 'stealth' ? '进度' : '伤害'}。`;
  }

  if (effect.type === 'damageAll') {
    return `对所有${target}${progress} ${effect.amount} 点${mode === 'stealth' ? '进度' : '伤害'}。`;
  }

  if (effect.type === 'damageRepeated') {
    const times =
      effect.times === 'x'
        ? 'X'
        : effect.times === 'hpLossEventsThisCombat'
          ? '失去生命次数'
          : String(effect.times);
    return `${progress} ${effect.amount} 点${mode === 'stealth' ? '进度' : '伤害'} ${times} 次。`;
  }

  if (effect.type === 'damageRandomEnemy') {
    return `对随机${target}${progress} ${effect.amount} 点${mode === 'stealth' ? '进度' : '伤害'} ${effect.times} 次。`;
  }

  if (effect.type === 'damageAllRepeated') {
    return `对所有${target}${progress} ${effect.amount} 点${mode === 'stealth' ? '进度' : '伤害'} X 次。`;
  }

  if (effect.type === 'damageEqualToBlock') {
    return mode === 'stealth' ? '推进等同于当前缓冲的进度。' : '造成等同于当前格挡的伤害。';
  }

  if (effect.type === 'block') {
    return `获得 ${effect.amount} 点${block}。`;
  }

  if (effect.type === 'draw') {
    return mode === 'stealth' ? `补充 ${effect.amount} 个${card}。` : `抽 ${effect.amount} 张${card}。`;
  }

  if (effect.type === 'drawUntilCardType') {
    const wanted = effect.cardType === 'attack' ? '攻击牌' : effect.cardType === 'skill' ? '技能牌' : '能力牌';
    return effect.invert ? `抽牌直到抽到 1 张非${wanted}。` : `抽牌直到抽到 1 张${wanted}。`;
  }

  if (effect.type === 'discard') {
    return mode === 'stealth' ? `移出 ${effect.amount} 个${card}。` : `弃掉 ${effect.amount} 张${card}。`;
  }

  if (effect.type === 'gainEnergy') {
    return `获得 ${effect.amount} 点${energy}。`;
  }

  if (effect.type === 'loseHp') {
    return `失去 ${effect.amount} 点${hp}。`;
  }

  if (effect.type === 'heal') {
    return `回复 ${effect.amount} 点${hp}。`;
  }

  if (effect.type === 'blockNextTurn') {
    return mode === 'stealth'
      ? `预留 ${effect.amount} 点下周期${block}。`
      : `获得 ${effect.amount} 点下回合${block}。`;
  }

  if (effect.type === 'applyStatus') {
    const verb = effect.target === 'player' ? '获得' : '施加';
    return `${verb} ${effect.amount} 层${statusName(effect.status, mode)}。`;
  }

  if (effect.type === 'applyStatusAll') {
    return `对所有${target}施加 ${effect.amount} 层${statusName(effect.status, mode)}。`;
  }

  if (effect.type === 'conditional') {
    const success = describeEffects(effect.effects, mode);
    const failure = effect.elseEffects ? describeEffects(effect.elseEffects, mode) : '';
    return failure ? `满足条件时，${success}否则，${failure}` : `满足条件时，${success}`;
  }

  if (effect.type === 'exhaustSelf') {
    return mode === 'stealth' ? '归档。' : '消耗。';
  }

  return '';
}

function statusName(status: StatusId, mode: 'normal' | 'stealth'): string {
  if (mode === 'normal') {
    return statusDefinitions[status].label;
  }

  const stealthNames: Partial<Record<StatusId, string>> = {
    vulnerable: '暴露',
    weak: '降效',
    frail: '易扰',
    strength: '推进增幅',
    dexterity: '响应',
    artifact: '防护凭证',
    thorns: '回弹',
    regen: '恢复',
    bleed: '持续风险',
    barrierLock: '缓冲锁定',
  };

  return stealthNames[status] ?? statusDefinitions[status].label;
}
