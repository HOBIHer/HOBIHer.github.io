import type { RelicDefinition } from '../../types';

export const relics: RelicDefinition[] = [
  {
    id: 'old-copper-clasp',
    name: '旧铜扣',
    lowProfileName: '旧扣凭证',
    rarity: 'common',
    description: '每场战斗开始时获得 1 点力量。',
    lowProfileDescription: '每次会话开始时获得 1 层推进增幅。',
    triggers: [
      {
        hook: 'onCombatStart',
        effects: [{ type: 'applyStatus', target: 'player', status: 'strength', amount: 1 }],
      },
    ],
  },
  {
    id: 'cracked-lens',
    name: '裂纹透镜',
    lowProfileName: '裂纹镜片',
    rarity: 'uncommon',
    description: '每场战斗第一回合多抽 1 张牌。',
    lowProfileDescription: '每次会话第一周期补充 1 个操作项。',
    triggers: [
      {
        hook: 'onTurnStart',
        condition: { type: 'turnEquals', value: 1 },
        effects: [{ type: 'draw', amount: 1 }],
      },
    ],
  },
  {
    id: 'sunken-paperweight',
    name: '沉纸镇',
    lowProfileName: '压纸凭证',
    rarity: 'common',
    description: '每场战斗开始时获得 4 点格挡。',
    lowProfileDescription: '每次会话开始时获得 4 点缓冲。',
    triggers: [
      {
        hook: 'onCombatStart',
        effects: [{ type: 'block', target: 'player', amount: 4 }],
      },
    ],
  },
  {
    id: 'ember-coin',
    name: '余温币',
    lowProfileName: '余温额度',
    rarity: 'uncommon',
    description: '每次洗牌时获得 1 点能量。',
    lowProfileDescription: '每次重排操作项时获得 1 点配额。',
    triggers: [
      {
        hook: 'onShuffle',
        effects: [{ type: 'gainEnergy', amount: 1 }],
      },
    ],
  },
  {
    id: 'quiet-glove',
    name: '静手套',
    lowProfileName: '静默手套',
    rarity: 'common',
    description: '每回合打出的第一张技能牌额外获得 3 点格挡。',
    lowProfileDescription: '每周期第一个支持项额外获得 3 点缓冲。',
    triggers: [
      {
        hook: 'onSkillPlayed',
        condition: { type: 'firstSkillThisTurn' },
        effects: [{ type: 'block', target: 'player', amount: 3 }],
      },
    ],
  },
  {
    id: 'salted-nail',
    name: '盐蚀钉',
    lowProfileName: '盐钉凭证',
    rarity: 'common',
    description: '每次打出攻击牌后获得 1 点格挡。',
    lowProfileDescription: '每次提交推进项后获得 1 点缓冲。',
    triggers: [
      {
        hook: 'onAttackPlayed',
        effects: [{ type: 'block', target: 'player', amount: 1 }],
      },
    ],
  },
  {
    id: 'ledger-bead',
    name: '账绳珠',
    lowProfileName: '记录珠',
    rarity: 'common',
    description: '每场战斗开始时获得 1 层敏捷。',
    lowProfileDescription: '每次会话开始时获得 1 层响应。',
    triggers: [
      {
        hook: 'onCombatStart',
        effects: [{ type: 'applyStatus', target: 'player', status: 'dexterity', amount: 1 }],
      },
    ],
  },
  {
    id: 'wax-seal',
    name: '温蜡封',
    lowProfileName: '温蜡凭证',
    rarity: 'common',
    description: '战斗胜利时回复 3 点生命。',
    lowProfileDescription: '会话完成时回复 3 点稳定度。',
    triggers: [
      {
        hook: 'onVictory',
        effects: [{ type: 'heal', amount: 3 }],
      },
    ],
  },
  {
    id: 'hinge-pin',
    name: '活页销',
    lowProfileName: '活页凭证',
    rarity: 'common',
    description: '击败敌人时获得 1 点能量。',
    lowProfileDescription: '完成一个目标时获得 1 点配额。',
    triggers: [
      {
        hook: 'onEnemyKilled',
        effects: [{ type: 'gainEnergy', amount: 1 }],
      },
    ],
  },
  {
    id: 'folded-ruler',
    name: '折尺',
    lowProfileName: '折尺凭证',
    rarity: 'common',
    description: '每场战斗第一回合开始时获得 3 点格挡。',
    lowProfileDescription: '每次会话第一周期开始时获得 3 点缓冲。',
    triggers: [
      {
        hook: 'onTurnStart',
        condition: { type: 'turnEquals', value: 1 },
        effects: [{ type: 'block', target: 'player', amount: 3 }],
      },
    ],
  },
  {
    id: 'blueprint-weight',
    name: '蓝图坠',
    lowProfileName: '方案坠',
    rarity: 'uncommon',
    description: '每回合打出的第一张技能牌额外抽 1 张牌。',
    lowProfileDescription: '每周期第一个支持项额外补充 1 个操作项。',
    triggers: [
      {
        hook: 'onSkillPlayed',
        condition: { type: 'firstSkillThisTurn' },
        effects: [{ type: 'draw', amount: 1 }],
      },
    ],
  },
  {
    id: 'silver-rivet',
    name: '银铆',
    lowProfileName: '银铆凭证',
    rarity: 'uncommon',
    description: '击败敌人时抽 1 张牌。',
    lowProfileDescription: '完成一个目标时补充 1 个操作项。',
    triggers: [
      {
        hook: 'onEnemyKilled',
        effects: [{ type: 'draw', amount: 1 }],
      },
    ],
  },
  {
    id: 'storm-cinder',
    name: '风暴余烬',
    lowProfileName: '高压凭证',
    rarity: 'uncommon',
    description: '每场战斗开始时获得 2 层力量和 1 层虚弱。',
    lowProfileDescription: '每次会话开始时获得 2 层推进增幅和 1 层降效。',
    triggers: [
      {
        hook: 'onCombatStart',
        effects: [
          { type: 'applyStatus', target: 'player', status: 'strength', amount: 2 },
          { type: 'applyStatus', target: 'player', status: 'weak', amount: 1 },
        ],
      },
    ],
  },
  {
    id: 'anchor-prism',
    name: '锚棱镜',
    lowProfileName: '重排凭证',
    rarity: 'rare',
    description: '每次洗牌时抽 2 张牌。',
    lowProfileDescription: '每次重排操作项时补充 2 个操作项。',
    triggers: [
      {
        hook: 'onShuffle',
        effects: [{ type: 'draw', amount: 2 }],
      },
    ],
  },
  {
    id: 'red-needle',
    name: '赤针',
    lowProfileName: '赤针凭证',
    rarity: 'rare',
    description: '每场战斗开始时获得 2 层力量和 1 层敏捷。',
    lowProfileDescription: '每次会话开始时获得 2 层推进增幅和 1 层响应。',
    triggers: [
      {
        hook: 'onCombatStart',
        effects: [
          { type: 'applyStatus', target: 'player', status: 'strength', amount: 2 },
          { type: 'applyStatus', target: 'player', status: 'dexterity', amount: 1 },
        ],
      },
    ],
  },
  {
    id: 'last-bell',
    name: '末铃',
    lowProfileName: '完成凭证',
    rarity: 'rare',
    description: '战斗胜利时回复 8 点生命。',
    lowProfileDescription: '会话完成时回复 8 点稳定度。',
    triggers: [
      {
        hook: 'onVictory',
        effects: [{ type: 'heal', amount: 8 }],
      },
    ],
  },
  {
    id: 'quiet-ledger',
    name: '静账册',
    lowProfileName: '静账凭证',
    rarity: 'uncommon',
    description: '每场战斗第一回合开始时抽 1 张牌并获得 1 点能量。',
    lowProfileDescription: '每次会话第一周期补充 1 个操作项并获得 1 点配额。',
    triggers: [
      {
        hook: 'onTurnStart',
        condition: { type: 'turnEquals', value: 1 },
        effects: [{ type: 'draw', amount: 1 }, { type: 'gainEnergy', amount: 1 }],
      },
    ],
  },
];

export const relicById: Record<string, RelicDefinition> = Object.fromEntries(
  relics.map((relic) => [relic.id, relic]),
);
