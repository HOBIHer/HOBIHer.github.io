import type { EnemyDefinition } from '../../types';

export const normalTrainingEnemies: EnemyDefinition[] = [
  {
    id: 'training_dummy',
    name: '训练木偶',
    lowProfileName: '单项测试',
    maxHp: 28,
    intentPattern: ['wooden-bump', 'loose-balance'],
    moves: [
      {
        id: 'wooden-bump',
        name: '木肩顶撞',
        intent: { type: 'attack', label: '攻击', damage: 5 },
        effects: [{ type: 'damage', amount: 5, target: 'player' }],
      },
      {
        id: 'loose-balance',
        name: '松弦摇晃',
        intent: { type: 'wait', label: '等待' },
        effects: [],
      },
    ],
  },
  {
    id: 'rust_scout',
    name: '锈刃巡查',
    lowProfileName: '外部事项',
    maxHp: 36,
    intentPattern: ['testing-cut', 'dust-kick', 'guarded-step'],
    moves: [
      {
        id: 'testing-cut',
        name: '试探划击',
        intent: { type: 'attack', label: '攻击', damage: 7 },
        effects: [{ type: 'damage', amount: 7, target: 'player' }],
      },
      {
        id: 'dust-kick',
        name: '扬尘压迫',
        intent: {
          type: 'mixed',
          label: '攻击并削弱',
          damage: 5,
          status: { id: 'weak', amount: 1 },
        },
        effects: [
          { type: 'damage', amount: 5, target: 'player' },
          { type: 'applyStatus', status: 'weak', amount: 1, target: 'player' },
        ],
      },
      {
        id: 'guarded-step',
        name: '收刃后撤',
        intent: { type: 'defend', label: '防守', block: 5 },
        effects: [{ type: 'block', amount: 5, target: 'self' }],
      },
    ],
  },
  {
    id: 'stone_clerk',
    name: '石簿归档',
    lowProfileName: '归档事项',
    maxHp: 42,
    intentPattern: ['close-the-ledger', 'weight-mark', 'stone-corner'],
    moves: [
      {
        id: 'close-the-ledger',
        name: '合簿守势',
        intent: { type: 'defend', label: '防守', block: 8 },
        effects: [{ type: 'block', amount: 8, target: 'self' }],
      },
      {
        id: 'weight-mark',
        name: '重印标记',
        intent: {
          type: 'mixed',
          label: '攻击并施压',
          damage: 6,
          status: { id: 'vulnerable', amount: 1 },
        },
        effects: [
          { type: 'damage', amount: 6, target: 'player' },
          { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'player' },
        ],
      },
      {
        id: 'stone-corner',
        name: '石角冲撞',
        intent: { type: 'attack', label: '重击', damage: 10 },
        effects: [{ type: 'damage', amount: 10, target: 'player' }],
      },
    ],
  },
  {
    id: 'harbor_mender',
    name: '港口修匠',
    lowProfileName: '维护事项',
    maxHp: 34,
    intentPattern: ['brace-panel', 'rivet-flick', 'oil-haze'],
    moves: [
      {
        id: 'brace-panel',
        name: '撑起护板',
        intent: { type: 'defend', label: '防守', block: 7 },
        effects: [{ type: 'block', amount: 7, target: 'self' }],
      },
      {
        id: 'rivet-flick',
        name: '弹铆钉',
        intent: { type: 'attack', label: '攻击', damage: 6 },
        effects: [{ type: 'damage', amount: 6, target: 'player' }],
      },
      {
        id: 'oil-haze',
        name: '油雾遮眼',
        intent: { type: 'debuff', label: '施加虚弱', status: { id: 'weak', amount: 1 } },
        effects: [{ type: 'applyStatus', status: 'weak', amount: 1, target: 'player' }],
      },
    ],
  },
  {
    id: 'coil_picker',
    name: '线圈拾荒者',
    lowProfileName: '临时事项',
    maxHp: 31,
    intentPattern: ['coil-snap', 'static-cover', 'coil-snap'],
    moves: [
      {
        id: 'coil-snap',
        name: '线圈抽打',
        intent: { type: 'attack', label: '攻击', damage: 8 },
        effects: [{ type: 'damage', amount: 8, target: 'player' }],
      },
      {
        id: 'static-cover',
        name: '静电包覆',
        intent: { type: 'mixed', label: '防守并增强', block: 4, status: { id: 'strength', amount: 1 } },
        effects: [
          { type: 'block', amount: 4, target: 'self' },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
    ],
  },
  {
    id: 'glass_meter',
    name: '玻璃量表',
    lowProfileName: '指标事项',
    maxHp: 26,
    intentPattern: ['thin-edge', 'read-pressure', 'thin-edge'],
    moves: [
      {
        id: 'thin-edge',
        name: '薄边割裂',
        intent: { type: 'mixed', label: '攻击并流血', damage: 5, status: { id: 'bleed', amount: 1 } },
        effects: [
          { type: 'damage', amount: 5, target: 'player' },
          { type: 'applyStatus', status: 'bleed', amount: 1, target: 'player' },
        ],
      },
      {
        id: 'read-pressure',
        name: '读压校准',
        intent: { type: 'debuff', label: '施加易损', status: { id: 'vulnerable', amount: 1 } },
        effects: [{ type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'player' }],
      },
    ],
  },
  {
    id: 'ash_bailiff',
    name: '灰印差役',
    lowProfileName: '催办事项',
    maxHp: 46,
    intentPattern: ['ash-stamp', 'seal-up', 'summons-push'],
    moves: [
      {
        id: 'ash-stamp',
        name: '灰印落章',
        intent: { type: 'attack', label: '攻击', damage: 9 },
        effects: [{ type: 'damage', amount: 9, target: 'player' }],
      },
      {
        id: 'seal-up',
        name: '封条绕身',
        intent: { type: 'defend', label: '防守', block: 9 },
        effects: [{ type: 'block', amount: 9, target: 'self' }],
      },
      {
        id: 'summons-push',
        name: '催办推搡',
        intent: { type: 'mixed', label: '攻击并施压', damage: 7, status: { id: 'frail', amount: 1 } },
        effects: [
          { type: 'damage', amount: 7, target: 'player' },
          { type: 'applyStatus', status: 'frail', amount: 1, target: 'player' },
        ],
      },
    ],
  },
  {
    id: 'brass_scribe',
    name: '黄铜抄写员',
    lowProfileName: '记录事项',
    maxHp: 39,
    intentPattern: ['ink-scratch', 'index-guard', 'margin-note'],
    moves: [
      {
        id: 'ink-scratch',
        name: '墨针刮写',
        intent: { type: 'attack', label: '攻击', damage: 6 },
        effects: [{ type: 'damage', amount: 6, target: 'player' }],
      },
      {
        id: 'index-guard',
        name: '索引护页',
        intent: { type: 'defend', label: '防守', block: 6 },
        effects: [{ type: 'block', amount: 6, target: 'self' }],
      },
      {
        id: 'margin-note',
        name: '边注误导',
        intent: { type: 'debuff', label: '施加虚弱', status: { id: 'weak', amount: 2 } },
        effects: [{ type: 'applyStatus', status: 'weak', amount: 2, target: 'player' }],
      },
    ],
  },
  {
    id: 'salt_runner',
    name: '盐线疾行者',
    lowProfileName: '移动事项',
    maxHp: 33,
    intentPattern: ['salt-dash', 'salt-dash', 'dry-wind'],
    moves: [
      {
        id: 'salt-dash',
        name: '盐线疾冲',
        intent: { type: 'attack', label: '攻击', damage: 7 },
        effects: [{ type: 'damage', amount: 7, target: 'player' }],
      },
      {
        id: 'dry-wind',
        name: '干风扫面',
        intent: { type: 'mixed', label: '攻击并脆弱', damage: 5, status: { id: 'frail', amount: 1 } },
        effects: [
          { type: 'damage', amount: 5, target: 'player' },
          { type: 'applyStatus', status: 'frail', amount: 1, target: 'player' },
        ],
      },
    ],
  },
];

export const eliteEnemies: EnemyDefinition[] = [
  {
    id: 'iron_beadle',
    name: '铁铃执事',
    lowProfileName: '高优先级事项',
    maxHp: 88,
    intentPattern: ['bell-staff-strike', 'iron-ledger-stance', 'dulling-order', 'summons-swing'],
    moves: [
      {
        id: 'bell-staff-strike',
        name: '铃杖敲击',
        intent: { type: 'attack', label: '攻击', damage: 12 },
        effects: [{ type: 'damage', amount: 12, target: 'player' }],
      },
      {
        id: 'iron-ledger-stance',
        name: '铁簿立势',
        intent: { type: 'mixed', label: '防守并增强', block: 10, status: { id: 'strength', amount: 1 } },
        effects: [
          { type: 'block', amount: 10, target: 'self' },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
      {
        id: 'dulling-order',
        name: '迟钝训令',
        intent: { type: 'mixed', label: '削弱并攻击', damage: 8, status: { id: 'weak', amount: 1 } },
        effects: [
          { type: 'applyStatus', status: 'weak', amount: 1, target: 'player' },
          { type: 'damage', amount: 8, target: 'player' },
        ],
      },
      {
        id: 'summons-swing',
        name: '传唤横扫',
        intent: { type: 'attack', label: '重击', damage: 16 },
        effects: [{ type: 'damage', amount: 16, target: 'player' }],
      },
    ],
  },
  {
    id: 'gear_cantor',
    name: '齿轮领唱者',
    lowProfileName: '同步事项',
    maxHp: 82,
    intentPattern: ['tempo-strike', 'gear-hymn', 'tempo-strike', 'discord-note'],
    moves: [
      {
        id: 'tempo-strike',
        name: '节拍重击',
        intent: { type: 'attack', label: '攻击', damage: 13 },
        effects: [{ type: 'damage', amount: 13, target: 'player' }],
      },
      {
        id: 'gear-hymn',
        name: '齿轮合唱',
        intent: { type: 'mixed', label: '增强并防守', block: 8, status: { id: 'strength', amount: 2 } },
        effects: [
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
          { type: 'block', amount: 8, target: 'self' },
        ],
      },
      {
        id: 'discord-note',
        name: '错拍噪音',
        intent: { type: 'debuff', label: '施加虚弱', status: { id: 'weak', amount: 2 } },
        effects: [{ type: 'applyStatus', status: 'weak', amount: 2, target: 'player' }],
      },
    ],
  },
  {
    id: 'ledger_knight',
    name: '账甲骑士',
    lowProfileName: '复核事项',
    maxHp: 96,
    intentPattern: ['audit-lance', 'balance-shield', 'audit-lance', 'red-penalty'],
    moves: [
      {
        id: 'audit-lance',
        name: '审计长枪',
        intent: { type: 'attack', label: '攻击', damage: 15 },
        effects: [{ type: 'damage', amount: 15, target: 'player' }],
      },
      {
        id: 'balance-shield',
        name: '平衡盾页',
        intent: { type: 'defend', label: '防守', block: 14 },
        effects: [{ type: 'block', amount: 14, target: 'self' }],
      },
      {
        id: 'red-penalty',
        name: '红字罚注',
        intent: { type: 'mixed', label: '攻击并易损', damage: 9, status: { id: 'vulnerable', amount: 2 } },
        effects: [
          { type: 'damage', amount: 9, target: 'player' },
          { type: 'applyStatus', status: 'vulnerable', amount: 2, target: 'player' },
        ],
      },
    ],
  },
  {
    id: 'cinder_notary',
    name: '余烬公证人',
    lowProfileName: '确认事项',
    maxHp: 78,
    intentPattern: ['ember-seal', 'warm-guard', 'burning-clause', 'ember-seal'],
    moves: [
      {
        id: 'ember-seal',
        name: '余烬封印',
        intent: { type: 'attack', label: '攻击', damage: 11 },
        effects: [{ type: 'damage', amount: 11, target: 'player' }],
      },
      {
        id: 'warm-guard',
        name: '温灰护签',
        intent: { type: 'mixed', label: '防守并增强', block: 9, status: { id: 'artifact', amount: 1 } },
        effects: [
          { type: 'block', amount: 9, target: 'self' },
          { type: 'applyStatus', status: 'artifact', amount: 1, target: 'self' },
        ],
      },
      {
        id: 'burning-clause',
        name: '燃尽条款',
        intent: { type: 'mixed', label: '攻击并流血', damage: 8, status: { id: 'bleed', amount: 2 } },
        effects: [
          { type: 'damage', amount: 8, target: 'player' },
          { type: 'applyStatus', status: 'bleed', amount: 2, target: 'player' },
        ],
      },
    ],
  },
];

export const bossEnemies: EnemyDefinition[] = [
  {
    id: 'bell_tower_guardian',
    name: '钟塔守卫',
    lowProfileName: '最终议题',
    maxHp: 140,
    intentPattern: ['clockface-slam', 'open-gear', 'wound-the-spring', 'hour-bell-crash', 'silent-charge'],
    moves: [
      {
        id: 'clockface-slam',
        name: '钟面压击',
        intent: { type: 'mixed', label: '攻击并防守', damage: 10, block: 6 },
        effects: [
          { type: 'damage', amount: 10, target: 'player' },
          { type: 'block', amount: 6, target: 'self' },
        ],
      },
      {
        id: 'open-gear',
        name: '开齿示隙',
        intent: { type: 'debuff', label: '施加易损', status: { id: 'vulnerable', amount: 1 } },
        effects: [{ type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'player' }],
      },
      {
        id: 'wound-the-spring',
        name: '上紧主簧',
        intent: { type: 'mixed', label: '增强并防守', block: 12, status: { id: 'strength', amount: 2 } },
        effects: [
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
          { type: 'block', amount: 12, target: 'self' },
        ],
      },
      {
        id: 'hour-bell-crash',
        name: '整点崩响',
        intent: { type: 'attack', label: '强击', damage: 20 },
        effects: [{ type: 'damage', amount: 20, target: 'player' }],
      },
      {
        id: 'silent-charge',
        name: '静默充能',
        intent: { type: 'wait', label: '充能' },
        effects: [],
      },
    ],
  },
  {
    id: 'tide_archive_prime',
    name: '潮档主机',
    lowProfileName: '终局档案',
    maxHp: 152,
    intentPattern: ['surge-index', 'archive-lock', 'salted-query', 'tidal-overwrite', 'quiet-rebuild'],
    moves: [
      {
        id: 'surge-index',
        name: '潮汐索引',
        intent: { type: 'mixed', label: '攻击并易损', damage: 12, status: { id: 'vulnerable', amount: 1 } },
        effects: [
          { type: 'damage', amount: 12, target: 'player' },
          { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'player' },
        ],
      },
      {
        id: 'archive-lock',
        name: '档案锁壳',
        intent: { type: 'defend', label: '防守', block: 16 },
        effects: [{ type: 'block', amount: 16, target: 'self' }],
      },
      {
        id: 'salted-query',
        name: '盐化查询',
        intent: { type: 'debuff', label: '施加虚弱', status: { id: 'weak', amount: 2 } },
        effects: [{ type: 'applyStatus', status: 'weak', amount: 2, target: 'player' }],
      },
      {
        id: 'tidal-overwrite',
        name: '潮线覆写',
        intent: { type: 'attack', label: '强击', damage: 22 },
        effects: [{ type: 'damage', amount: 22, target: 'player' }],
      },
      {
        id: 'quiet-rebuild',
        name: '静默重建',
        intent: { type: 'mixed', label: '增强并防守', block: 10, status: { id: 'strength', amount: 2 } },
        effects: [
          { type: 'block', amount: 10, target: 'self' },
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
        ],
      },
    ],
  },
];

export const trainingEnemies: EnemyDefinition[] = [
  ...normalTrainingEnemies,
  ...eliteEnemies,
  ...bossEnemies,
];

export const trainingEnemyById: Record<string, EnemyDefinition> = Object.fromEntries(
  trainingEnemies.map((enemy) => [enemy.id, enemy]),
);
