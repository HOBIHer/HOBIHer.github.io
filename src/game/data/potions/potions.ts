import type { PotionDefinition } from '../../types';

export const potions: PotionDefinition[] = [
  {
    id: 'small-healing-fluid',
    name: '小型治疗液',
    lowProfileName: '稳定补剂',
    description: '恢复 10 点生命，不超过最大生命。',
    lowProfileDescription: '恢复 10 点稳定度，不超过稳定度上限。',
    target: 'self',
    effects: [{ type: 'heal', amount: 10 }],
  },
  {
    id: 'strength-draught',
    name: '力量药剂',
    lowProfileName: '强化补剂',
    description: '本场战斗获得 2 层力量。',
    lowProfileDescription: '本次会话获得 2 层推进增幅。',
    target: 'self',
    effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'player' }],
  },
  {
    id: 'guard-draught',
    name: '防护药剂',
    lowProfileName: '缓冲补剂',
    description: '获得 12 点格挡。',
    lowProfileDescription: '获得 12 点缓冲。',
    target: 'self',
    effects: [{ type: 'block', amount: 12 }],
  },
  {
    id: 'draw-draught',
    name: '抽牌药剂',
    lowProfileName: '补充补剂',
    description: '抽 2 张牌。',
    lowProfileDescription: '补充 2 个操作项。',
    target: 'self',
    effects: [{ type: 'draw', amount: 2 }],
  },
  {
    id: 'risk-mark-bottle',
    name: '易损瓶',
    lowProfileName: '风险标记瓶',
    description: '使一个敌人获得 2 层易损。',
    lowProfileDescription: '使一个目标获得 2 层暴露。',
    target: 'enemy',
    effects: [{ type: 'applyStatus', status: 'vulnerable', amount: 2, target: 'enemy' }],
  },
];

export const potionById: Record<string, PotionDefinition> = Object.fromEntries(
  potions.map((potion) => [potion.id, potion]),
);
