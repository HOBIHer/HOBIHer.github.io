import type { AscensionLevel } from '../types';

export const MAX_ASCENSION_LEVEL: AscensionLevel = 10;

export const DEFAULT_ASCENSION_PROGRESS = {
  unlockedLevel: 0 as AscensionLevel,
};

export interface AscensionRestriction {
  level: AscensionLevel;
  label: string;
  lowProfileLabel: string;
}

export const ASCENSION_RESTRICTIONS: AscensionRestriction[] = [
  { level: 1, label: '精英更多', lowProfileLabel: '重点项更多' },
  { level: 2, label: '休整回复降低 20%', lowProfileLabel: '整理恢复降低 20%' },
  { level: 3, label: '金币奖励降低 25%', lowProfileLabel: '资源回收降低 25%' },
  { level: 4, label: '初始药水栏 -1', lowProfileLabel: '初始补剂栏 -1' },
  { level: 5, label: '初始加入一张诅咒', lowProfileLabel: '初始加入一张负担项' },
  { level: 6, label: '商店移除更贵', lowProfileLabel: '资源面板清理更贵' },
  { level: 7, label: '稀有牌出现更少', lowProfileLabel: '高价值项出现更少' },
  { level: 8, label: '敌人生命更高', lowProfileLabel: '对向目标稳定度更高' },
  { level: 9, label: '敌人伤害更高', lowProfileLabel: '对向目标输出更高' },
  { level: 10, label: '最终双 Boss', lowProfileLabel: '最终双议题' },
];

export function clampAscensionLevel(level: number): AscensionLevel {
  return Math.min(MAX_ASCENSION_LEVEL, Math.max(0, Math.floor(level))) as AscensionLevel;
}

export function hasAscension(level: AscensionLevel, required: AscensionLevel): boolean {
  return level >= required;
}

export function unlockNextAscensionLevel(level: AscensionLevel): AscensionLevel {
  return clampAscensionLevel(level + 1);
}

export function getStartingPotionSlots(level: AscensionLevel): number {
  return hasAscension(level, 4) ? 2 : 3;
}

export function getRestHealAmount(maxHp: number, level: AscensionLevel): number {
  const base = Math.floor(maxHp * 0.3);
  return Math.max(1, Math.floor(base * (hasAscension(level, 2) ? 0.8 : 1)));
}

export function getRewardGoldAmount(gold: number, level: AscensionLevel): number {
  return hasAscension(level, 3) ? Math.floor(gold * 0.75) : gold;
}

export function getShopRemoveCardPrice(level: AscensionLevel): number {
  return hasAscension(level, 6) ? 100 : 75;
}

export function getAscensionEnemyMaxHp(maxHp: number, level: AscensionLevel): number {
  return hasAscension(level, 8) ? Math.ceil(maxHp * 1.15) : maxHp;
}

export function getAscensionEnemyDamage(amount: number, level: AscensionLevel): number {
  return hasAscension(level, 9) ? Math.ceil(amount * 1.2) : amount;
}
