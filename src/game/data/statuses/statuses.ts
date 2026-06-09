import type { StatusDefinition, StatusId } from '../../types';

export const statusDefinitions: Record<StatusId, StatusDefinition> = {
  strength: {
    id: 'strength',
    label: '力量',
    decayTiming: 'never',
    attackDamageDealtFlatPerStack: 1,
  },
  dexterity: {
    id: 'dexterity',
    label: '敏捷',
    decayTiming: 'never',
    blockGainFlatPerStack: 1,
  },
  vulnerable: {
    id: 'vulnerable',
    label: '易损',
    isNegative: true,
    decayTiming: 'turnEnd',
    attackDamageReceivedMultiplier: 1.5,
  },
  weak: {
    id: 'weak',
    label: '虚弱',
    isNegative: true,
    decayTiming: 'turnEnd',
    attackDamageDealtMultiplier: 0.75,
  },
  frail: {
    id: 'frail',
    label: '脆弱',
    isNegative: true,
    decayTiming: 'turnEnd',
    blockGainMultiplier: 0.75,
  },
  artifact: {
    id: 'artifact',
    label: '屏障',
    decayTiming: 'never',
    preventsNegativeStatus: true,
  },
  thorns: {
    id: 'thorns',
    label: '荆刺',
    decayTiming: 'never',
    thornsDamagePerStack: 1,
  },
  regen: {
    id: 'regen',
    label: '再生',
    decayTiming: 'turnEnd',
    turnEndHealPerStack: 1,
  },
  bleed: {
    id: 'bleed',
    label: '流血',
    isNegative: true,
    decayTiming: 'turnEnd',
    turnEndHpLossPerStack: 1,
  },
  barrierLock: {
    id: 'barrierLock',
    label: '锁盾',
    decayTiming: 'turnStart',
    preservesBlockAtTurnStart: true,
  },
};

export const statusIds = Object.keys(statusDefinitions) as StatusId[];
