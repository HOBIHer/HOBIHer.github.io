import type { GameMode, StatusId } from '../../game/types';

const normalDescriptions: Partial<Record<StatusId, string>> = {
  vulnerable: '受到攻击伤害提高，层数会在回合结束时衰减。',
  weak: '造成的攻击伤害降低，层数会在回合结束时衰减。',
  frail: '获得的格挡降低，层数会在回合结束时衰减。',
  strength: '攻击伤害按层数提高，不会自然衰减。',
  dexterity: '格挡获得量按层数提高，不会自然衰减。',
  artifact: '抵消下一次负面状态，然后减少一层。',
  thorns: '受到造成生命损失的攻击时，对攻击者造成反击伤害。',
  regen: '回合结束时回复生命，然后减少一层。',
  bleed: '回合结束时失去生命，然后减少一层。',
  barrierLock: '下个回合开始时保留当前格挡，然后减少一层。',
};

const stealthDescriptions: Partial<Record<StatusId, string>> = {
  vulnerable: '当前目标承压更高，推进效果会被放大。',
  weak: '当前目标输出效率下降，会在周期结束时衰减。',
  frail: '缓冲生成效率下降，会在周期结束时衰减。',
  strength: '推进力度提高，默认持续生效。',
  dexterity: '缓冲效率提高，默认持续生效。',
  artifact: '抵消下一次不利标记，然后减少一层。',
  thorns: '受到有效推进时，会对来源产生回弹。',
  regen: '周期结束时恢复稳定度，然后减少一层。',
  bleed: '周期结束时损失稳定度，然后减少一层。',
  barrierLock: '下个周期开始时保留当前缓冲，然后减少一层。',
};

export function getStatusDescription(status: StatusId, mode: GameMode = 'normal'): string {
  const description = mode === 'stealth' ? stealthDescriptions[status] : normalDescriptions[status];
  return description ?? '特殊规则状态。';
}
