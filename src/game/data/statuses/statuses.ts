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
  blockRetention: {
    id: 'blockRetention',
    label: '守势留存',
    decayTiming: 'never',
    preservesBlockEveryTurn: true,
  },
  noDraw: {
    id: 'noDraw',
    label: '封抽',
    decayTiming: 'turnStart',
  },
  noEnergyGain: {
    id: 'noEnergyGain',
    label: '封能',
    decayTiming: 'turnStart',
  },
  vulnerableEnemyDamageReduction: {
    id: 'vulnerableEnemyDamageReduction',
    label: '露隙减伤',
    decayTiming: 'turnStart',
  },
  skillZeroExhaust: {
    id: 'skillZeroExhaust',
    label: '技艺归零',
    decayTiming: 'never',
  },
  startTurnLoseHpBlock: {
    id: 'startTurnLoseHpBlock',
    label: '血盾轮转',
    decayTiming: 'never',
  },
  vulnerableDamageBonus: {
    id: 'vulnerableDamageBonus',
    label: '易损放大',
    decayTiming: 'never',
  },
  drawOnExhaust: {
    id: 'drawOnExhaust',
    label: '归档补牌',
    decayTiming: 'never',
  },
  blockOnExhaust: {
    id: 'blockOnExhaust',
    label: '归档缓冲',
    decayTiming: 'never',
  },
  startTurnStrength: {
    id: 'startTurnStrength',
    label: '回合蓄力',
    decayTiming: 'never',
  },
  startTurnExhaustTopCard: {
    id: 'startTurnExhaustTopCard',
    label: '顶牌归档',
    decayTiming: 'never',
  },
  startTurnRecallAttack: {
    id: 'startTurnRecallAttack',
    label: '回收攻击',
    decayTiming: 'never',
  },
  counterAttack: {
    id: 'counterAttack',
    label: '临时反击',
    decayTiming: 'turnStart',
  },
  autoPlayDrawnBasicAttack: {
    id: 'autoPlayDrawnBasicAttack',
    label: '基础追击',
    decayTiming: 'never',
  },
  startTurnLoseHpDamageAll: {
    id: 'startTurnLoseHpDamageAll',
    label: '血钟启动',
    decayTiming: 'never',
  },
  damageAllOnHpLoss: {
    id: 'damageAllOnHpLoss',
    label: '失血震荡',
    decayTiming: 'never',
  },
  damageRandomOnBlock: {
    id: 'damageRandomOnBlock',
    label: '格挡震击',
    decayTiming: 'never',
  },
  thirdAttackCopy: {
    id: 'thirdAttackCopy',
    label: '三击复写',
    decayTiming: 'never',
  },
  temporaryStrength: {
    id: 'temporaryStrength',
    label: '临时力量',
    decayTiming: 'turnEnd',
  },
  nextAttackExtraPlay: {
    id: 'nextAttackExtraPlay',
    label: '追击预备',
    decayTiming: 'turnStart',
  },
  nextAttackFree: {
    id: 'nextAttackFree',
    label: '免费攻击',
    decayTiming: 'turnStart',
  },
  startTurnEnergy: {
    id: 'startTurnEnergy',
    label: '回合配额',
    decayTiming: 'never',
  },
  attackBlockThisTurn: {
    id: 'attackBlockThisTurn',
    label: '攻击缓冲',
    decayTiming: 'turnStart',
  },
  hpLossStrength: {
    id: 'hpLossStrength',
    label: '失血蓄力',
    decayTiming: 'never',
  },
  endTurnAutoPlayAttack: {
    id: 'endTurnAutoPlayAttack',
    label: '末端代理',
    decayTiming: 'never',
  },
  firstCardBlockDouble: {
    id: 'firstCardBlockDouble',
    label: '首盾翻倍',
    decayTiming: 'never',
  },
  drawOnVulnerable: {
    id: 'drawOnVulnerable',
    label: '露隙补牌',
    decayTiming: 'never',
  },
};

export const statusIds = Object.keys(statusDefinitions) as StatusId[];
