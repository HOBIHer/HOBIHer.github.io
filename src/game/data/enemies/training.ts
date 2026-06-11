import type {
  ActNumber,
  EnemyDefinition,
  EnemyEffect,
  EnemyMove,
  EnemyRole,
  StatusId,
  StatusMap,
} from '../../types';

const legacyNormalEnemies: EnemyDefinition[] = [
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

const legacyEliteEnemies: EnemyDefinition[] = [
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

const legacyBossEnemies: EnemyDefinition[] = [
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
  {
    id: 'oath_mirror_warden',
    name: '誓镜看守',
    lowProfileName: '终局复核',
    maxHp: 168,
    intentPattern: ['mirror-cut', 'polish-guard', 'doubt-reflection', 'oath-break', 'reset-glass'],
    moves: [
      {
        id: 'mirror-cut',
        name: '镜面裁切',
        intent: { type: 'attack', label: '攻击', damage: 14 },
        effects: [{ type: 'damage', amount: 14, target: 'player' }],
      },
      {
        id: 'polish-guard',
        name: '抛光守势',
        intent: { type: 'mixed', label: '防守并增强', block: 18, status: { id: 'strength', amount: 1 } },
        effects: [
          { type: 'block', amount: 18, target: 'self' },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
      {
        id: 'doubt-reflection',
        name: '疑影反照',
        intent: { type: 'debuff', label: '施加虚弱', status: { id: 'weak', amount: 2 } },
        effects: [{ type: 'applyStatus', status: 'weak', amount: 2, target: 'player' }],
      },
      {
        id: 'oath-break',
        name: '誓面碎击',
        intent: { type: 'mixed', label: '强击并脆弱', damage: 24, status: { id: 'frail', amount: 1 } },
        effects: [
          { type: 'damage', amount: 24, target: 'player' },
          { type: 'applyStatus', status: 'frail', amount: 1, target: 'player' },
        ],
      },
      {
        id: 'reset-glass',
        name: '重置镜框',
        intent: { type: 'defend', label: '防守', block: 12 },
        effects: [{ type: 'block', amount: 12, target: 'self' }],
      },
    ],
  },
];

interface V160EnemyConfig {
  id: string;
  name: string;
  lowProfileName?: string;
  act: ActNumber;
  role: EnemyRole;
  maxHp: number;
  initialStatuses?: StatusMap;
  moves: EnemyMove[];
}

function v160Enemy(config: V160EnemyConfig): EnemyDefinition {
  return {
    id: config.id,
    name: config.name,
    lowProfileName: config.lowProfileName ?? `${roleLabel(config.role)}-${config.act}`,
    description: `${config.name} v1.6.0 enemy.`,
    lowProfileDescription: `Act ${config.act} ${roleLabel(config.role)} item.`,
    act: config.act,
    role: config.role,
    maxHp: config.maxHp,
    initialStatuses: config.initialStatuses,
    intentPattern: config.moves.map((move) => move.id),
    moves: config.moves,
  };
}

function roleLabel(role: EnemyRole): string {
  if (role === 'boss') {
    return 'Final item';
  }
  if (role === 'elite') {
    return 'Priority item';
  }
  if (role === 'part') {
    return 'Linked item';
  }
  if (role === 'summon') {
    return 'Support item';
  }
  return 'Routine item';
}

function attackMove(id: string, name: string, damage: number): EnemyMove {
  return {
    id,
    name,
    lowProfileName: 'Advance',
    intent: { type: 'attack', label: 'Attack', damage },
    effects: [{ type: 'damage', amount: damage, target: 'player' }],
  };
}

function multiAttackMove(id: string, name: string, amount: number, times: number): EnemyMove {
  return {
    id,
    name,
    lowProfileName: 'Repeated advance',
    intent: { type: 'attack', label: 'Multi attack', damage: amount * times },
    effects: [{ type: 'damageRepeated', amount, times, target: 'player' }],
  };
}

function blockMove(id: string, name: string, block: number): EnemyMove {
  return {
    id,
    name,
    lowProfileName: 'Buffer',
    intent: { type: 'defend', label: 'Block', block },
    effects: [{ type: 'block', amount: block, target: 'self' }],
  };
}

function statusMove(
  id: string,
  name: string,
  status: StatusId,
  amount: number,
  target: 'player' | 'self' = 'player',
): EnemyMove {
  return {
    id,
    name,
    lowProfileName: target === 'self' ? 'Self marker' : 'Marker',
    intent: {
      type: target === 'self' ? 'defend' : 'debuff',
      label: target === 'self' ? 'Buff' : 'Debuff',
      status: { id: status, amount },
    },
    effects: [{ type: 'applyStatus', status, amount, target }],
  };
}

function mixedMove(
  id: string,
  name: string,
  intent: EnemyMove['intent'],
  effects: EnemyEffect[],
): EnemyMove {
  return {
    id,
    name,
    lowProfileName: 'Combined step',
    intent,
    effects,
  };
}

function attackStatusMove(
  id: string,
  name: string,
  damage: number,
  status: StatusId,
  amount: number,
): EnemyMove {
  return mixedMove(
    id,
    name,
    { type: 'mixed', label: 'Attack + status', damage, status: { id: status, amount } },
    [
      { type: 'damage', amount: damage, target: 'player' },
      { type: 'applyStatus', status, amount, target: 'player' },
    ],
  );
}

function attackBlockMove(id: string, name: string, damage: number, block: number): EnemyMove {
  return mixedMove(
    id,
    name,
    { type: 'mixed', label: 'Attack + block', damage, block },
    [
      { type: 'damage', amount: damage, target: 'player' },
      { type: 'block', amount: block, target: 'self' },
    ],
  );
}

function attackSelfStatusMove(
  id: string,
  name: string,
  damage: number,
  status: StatusId,
  amount: number,
): EnemyMove {
  return mixedMove(
    id,
    name,
    { type: 'mixed', label: 'Attack + buff', damage, status: { id: status, amount } },
    [
      { type: 'damage', amount: damage, target: 'player' },
      { type: 'applyStatus', status, amount, target: 'self' },
    ],
  );
}

function multiStatusMove(
  id: string,
  name: string,
  damage: number,
  times: number,
  status: StatusId,
  amount: number,
): EnemyMove {
  return mixedMove(
    id,
    name,
    { type: 'mixed', label: 'Multi attack + status', damage: damage * times, status: { id: status, amount } },
    [
      { type: 'damageRepeated', amount: damage, times, target: 'player' },
      { type: 'applyStatus', status, amount, target: 'player' },
    ],
  );
}

const v160Act1NormalEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'assassin_raider', name: 'Assassin Raider', act: 1, role: 'normal', maxHp: 38, moves: [attackMove('killshot', 'Killshot', 11)] }),
  v160Enemy({ id: 'axe_raider', name: 'Axe Raider', act: 1, role: 'normal', maxHp: 44, moves: [attackBlockMove('single-attack', 'Single Attack', 7, 5), attackMove('big-swing', 'Big Swing', 12)] }),
  v160Enemy({ id: 'brute_raider', name: 'Brute Raider', act: 1, role: 'normal', maxHp: 48, moves: [attackMove('beat', 'Beat', 9), statusMove('buff', 'Buff', 'strength', 3, 'self')] }),
  v160Enemy({ id: 'crossbow_raider', name: 'Crossbow Raider', act: 1, role: 'normal', maxHp: 34, moves: [blockMove('reload', 'Reload', 3), attackMove('fire', 'Fire!', 14)] }),
  v160Enemy({ id: 'tracker_raider', name: 'Tracker Raider', act: 1, role: 'normal', maxHp: 36, moves: [statusMove('track', 'Track', 'frail', 2), attackMove('unleash-hounds', 'Unleash the Hounds', 1)] }),
  v160Enemy({ id: 'cubex_construct', name: 'Cubex Construct', act: 1, role: 'normal', maxHp: 54, initialStatuses: { artifact: 1 }, moves: [statusMove('charge-up', 'Charge Up', 'strength', 2, 'self'), attackSelfStatusMove('construct-swing', 'Construct Swing', 7, 'strength', 2), multiAttackMove('multi-attack', 'Multi Attack', 5, 2), blockMove('submerge', 'Submerge', 15)] }),
  v160Enemy({ id: 'eye_with_teeth', name: 'Eye With Teeth', act: 1, role: 'normal', maxHp: 16, moves: [statusMove('distract', 'Distract', 'weak', 1)] }),
  v160Enemy({ id: 'flyconid', name: 'Flyconid', act: 1, role: 'normal', maxHp: 42, moves: [attackStatusMove('vulnerable-spores', 'Vulnerable Spores', 6, 'vulnerable', 2), attackStatusMove('frail-spores', 'Frail Spores', 6, 'frail', 2), attackMove('smash', 'Smash', 11)] }),
  v160Enemy({ id: 'fogmog', name: 'Fogmog', act: 1, role: 'normal', maxHp: 48, moves: [statusMove('illusion', 'Illusion', 'pollutionDazed', 1), attackSelfStatusMove('swipe', 'Swipe', 8, 'strength', 1), attackMove('headbutt', 'Headbutt', 14)] }),
  v160Enemy({ id: 'fuzzy_wurm_crawler', name: 'Fuzzy Wurm Crawler', act: 1, role: 'normal', maxHp: 50, moves: [attackMove('acid-goop', 'Acid Goop', 9), statusMove('inhale', 'Inhale', 'strength', 7, 'self')] }),
  v160Enemy({ id: 'inklet', name: 'Inklet', act: 1, role: 'normal', maxHp: 32, initialStatuses: { slippery: 1 }, moves: [attackMove('jab', 'Jab', 6), multiAttackMove('whirlwind', 'Whirlwind', 4, 3), attackMove('piercing-gaze', 'Piercing Gaze', 10)] }),
  v160Enemy({ id: 'leaf_slime_m', name: 'Leaf Slime (M)', act: 1, role: 'normal', maxHp: 38, moves: [statusMove('sticky-shot', 'Sticky Shot', 'pollutionSlimed', 2), attackMove('clump-shot', 'Clump Shot', 8)] }),
  v160Enemy({ id: 'leaf_slime_s', name: 'Leaf Slime (S)', act: 1, role: 'normal', maxHp: 22, moves: [attackMove('butt', 'Butt', 5), statusMove('goop', 'Goop', 'pollutionSlimed', 1)] }),
  v160Enemy({ id: 'twig_slime_m', name: 'Twig Slime (M)', act: 1, role: 'normal', maxHp: 40, moves: [attackMove('clump-shot', 'Clump Shot', 11), statusMove('sticky-shot', 'Sticky Shot', 'pollutionSlimed', 1)] }),
  v160Enemy({ id: 'twig_slime_s', name: 'Twig Slime (S)', act: 1, role: 'normal', maxHp: 24, moves: [attackMove('butt', 'Butt', 6)] }),
  v160Enemy({ id: 'mawler', name: 'Mawler', act: 1, role: 'normal', maxHp: 54, moves: [multiAttackMove('claw', 'Claw', 5, 2), attackMove('rip-and-tear', 'Rip and Tear', 14), statusMove('roar', 'Roar', 'vulnerable', 2)] }),
  v160Enemy({ id: 'nibbit', name: 'Nibbit', act: 1, role: 'normal', maxHp: 31, moves: [attackMove('butt', 'Butt', 12), attackBlockMove('slice', 'Slice', 7, 5), statusMove('hiss', 'Hiss', 'strength', 2, 'self')] }),
  v160Enemy({ id: 'shrinker_beetle', name: 'Shrinker Beetle', act: 1, role: 'normal', maxHp: 45, moves: [statusMove('shrinker', 'Shrinker', 'enemyAttackDown30', 2), attackMove('chomp', 'Chomp', 8), attackMove('stomp', 'Stomp', 13)] }),
  v160Enemy({ id: 'slithering_strangler', name: 'Slithering Strangler', act: 1, role: 'normal', maxHp: 49, moves: [statusMove('constrict', 'Constrict', 'constrict', 3), attackBlockMove('twack', 'Twack', 8, 5), attackMove('lash', 'Lash', 12)] }),
  v160Enemy({ id: 'snapping_jaxfruit', name: 'Snapping Jaxfruit', act: 1, role: 'normal', maxHp: 46, moves: [attackSelfStatusMove('energy-orb', 'Energy Orb', 8, 'strength', 2)] }),
  v160Enemy({ id: 'vine_shambler', name: 'Vine Shambler', act: 1, role: 'normal', maxHp: 52, moves: [attackStatusMove('grasping-vines', 'Grasping Vines', 8, 'tangled', 1), multiAttackMove('swipe', 'Swipe', 5, 2), attackMove('chomp', 'Chomp', 16)] }),
];

const v160Act1EliteEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'bygone_effigy', name: 'Bygone Effigy', act: 1, role: 'elite', maxHp: 88, initialStatuses: { slumber: 1 }, moves: [mixedMove('sleep', 'Sleep', { type: 'wait', label: 'Wait' }, []), mixedMove('awaken', 'Awaken', { type: 'mixed', label: 'Awaken', status: { id: 'strength', amount: 10 } }, [{ type: 'applyStatus', status: 'strength', amount: 10, target: 'self' }, { type: 'applyStatus', status: 'slow', amount: 1, target: 'player' }]), attackMove('heavy-chop', 'Heavy Chop', 24)] }),
  v160Enemy({ id: 'byrdonis', name: 'Byrdonis', act: 1, role: 'elite', maxHp: 92, initialStatuses: { ritual: 1 }, moves: [attackMove('swoop', 'Swoop', 16), attackMove('peck', 'Peck', 9)] }),
  v160Enemy({ id: 'phrog_parasite', name: 'Phrog Parasite', act: 1, role: 'elite', maxHp: 86, moves: [statusMove('infect', 'Infect', 'infection', 1), multiAttackMove('lash', 'Lash', 4, 4)] }),
  v160Enemy({ id: 'wriggler', name: 'Wriggler', act: 1, role: 'elite', maxHp: 32, initialStatuses: { spawned: 1, stun: 1 }, moves: [attackMove('nasty-bite', 'Nasty Bite', 8), mixedMove('wriggle', 'Wriggle', { type: 'mixed', label: 'Buff + status', status: { id: 'strength', amount: 2 } }, [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }, { type: 'applyStatus', status: 'pollutionDazed', amount: 1, target: 'player' }])] }),
];

const v160Act1BossEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'vantom', name: 'Vantom', act: 1, role: 'boss', maxHp: 150, initialStatuses: { slippery: 9 }, moves: [attackMove('ink-blot', 'Ink Blot', 9), multiAttackMove('inky-lance', 'Inky Lance', 7, 2), attackStatusMove('dismember', 'Dismember', 17, 'pollutionWound', 1), statusMove('prepare', 'Prepare', 'strength', 2, 'self')] }),
  v160Enemy({ id: 'ceremonial_beast', name: 'Ceremonial Beast', act: 1, role: 'boss', maxHp: 165, initialStatuses: { plow: 150 }, moves: [attackSelfStatusMove('plow', 'Plow', 18, 'strength', 2), statusMove('beast-cry', 'Beast Cry', 'ringing', 1), attackMove('stomp', 'Stomp', 15), attackSelfStatusMove('crush', 'Crush', 17, 'strength', 3)] }),
  v160Enemy({ id: 'kin_priest', name: 'Kin Priest', act: 1, role: 'boss', maxHp: 190, moves: [attackStatusMove('orb-frailty', 'Orb of Frailty', 8, 'frail', 2), attackStatusMove('orb-weakness', 'Orb of Weakness', 8, 'weak', 2), multiAttackMove('beam', 'Beam', 3, 3), statusMove('ritual', 'Ritual', 'ritual', 2, 'self')] }),
  v160Enemy({ id: 'kin_follower', name: 'Kin Follower', act: 1, role: 'boss', maxHp: 58, moves: [attackMove('quick-slash', 'Quick Slash', 5), multiAttackMove('boomerang', 'Boomerang', 2, 2), statusMove('power-dance', 'Power Dance', 'strength', 2, 'self')] }),
];

const v160Act2NormalEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'bowlbug_egg', name: 'Bowlbug (Egg)', act: 2, role: 'normal', maxHp: 58, moves: [attackBlockMove('bite', 'Bite', 8, 7)] }),
  v160Enemy({ id: 'bowlbug_nectar', name: 'Bowlbug (Nectar)', act: 2, role: 'normal', maxHp: 52, moves: [attackMove('thrash', 'Thrash', 7), statusMove('buff', 'Buff', 'strength', 15, 'self')] }),
  v160Enemy({ id: 'bowlbug_rock', name: 'Bowlbug (Rock)', act: 2, role: 'normal', maxHp: 66, moves: [attackMove('headbutt', 'Headbutt', 15), statusMove('dizzy', 'Dizzy', 'stun', 1, 'self')] }),
  v160Enemy({ id: 'bowlbug_silk', name: 'Bowlbug (Silk)', act: 2, role: 'normal', maxHp: 50, moves: [multiAttackMove('trash', 'Trash', 5, 2), statusMove('toxic-spit', 'Toxic Spit', 'weak', 1)] }),
  v160Enemy({ id: 'chomper', name: 'Chomper', act: 2, role: 'normal', maxHp: 56, initialStatuses: { artifact: 2 }, moves: [multiAttackMove('clamp', 'Clamp', 6, 2), statusMove('screech', 'Screech', 'pollutionDazed', 1)] }),
  v160Enemy({ id: 'exoskeleton', name: 'Exoskeleton', act: 2, role: 'normal', maxHp: 54, moves: [attackMove('skitter', 'Skitter', 8), attackMove('mandible', 'Mandible', 10), statusMove('enrage', 'Enrage', 'strength', 2, 'self')] }),
  v160Enemy({ id: 'hunter_killer', name: 'Hunter Killer', act: 2, role: 'normal', maxHp: 62, moves: [statusMove('tenderizing-goop', 'Tenderizing Goop', 'tender', 1), attackMove('bite', 'Bite', 17), multiAttackMove('puncture', 'Puncture', 5, 3)] }),
  v160Enemy({ id: 'louse_progenitor', name: 'Louse Progenitor', act: 2, role: 'normal', maxHp: 68, initialStatuses: { curlUp: 14 }, moves: [attackStatusMove('web-cannon', 'Web Cannon', 8, 'frail', 2), mixedMove('curl-and-grow', 'Curl and Grow', { type: 'mixed', label: 'Block + buff', block: 14, status: { id: 'strength', amount: 5 } }, [{ type: 'block', amount: 14, target: 'self' }, { type: 'applyStatus', status: 'strength', amount: 5, target: 'self' }]), attackMove('pounce', 'Pounce', 14)] }),
  v160Enemy({ id: 'myte', name: 'Myte', act: 2, role: 'normal', maxHp: 34, moves: [statusMove('toxic-cornucopia', 'Toxic Cornucopia', 'toxic', 1), attackMove('bite', 'Bite', 13), attackSelfStatusMove('suck', 'Suck', 7, 'strength', 2)] }),
  v160Enemy({ id: 'ovicopter', name: 'Ovicopter', act: 2, role: 'normal', maxHp: 64, moves: [statusMove('lay-eggs', 'Lay Eggs', 'spawned', 3, 'self'), attackMove('smash', 'Smash', 16), attackStatusMove('tenderizer', 'Tenderizer', 8, 'vulnerable', 2)] }),
  v160Enemy({ id: 'tough_egg', name: 'Tough Egg', act: 2, role: 'summon', maxHp: 18, moves: [statusMove('hatch', 'Hatch', 'spawned', 1, 'self'), attackMove('nibble', 'Nibble', 4)] }),
  v160Enemy({ id: 'slumbering_beetle', name: 'Slumbering Beetle', act: 2, role: 'normal', maxHp: 72, initialStatuses: { plating: 15, slumber: 3 }, moves: [attackSelfStatusMove('roll-out', 'Roll Out', 16, 'strength', 2)] }),
  v160Enemy({ id: 'spiny_toad', name: 'Spiny Toad', act: 2, role: 'normal', maxHp: 60, moves: [statusMove('protruding-spikes', 'Protruding Spikes', 'thorns', 15, 'self'), attackMove('spike-explosion', 'Spike Explosion', 13), attackMove('tongue-lash', 'Tongue Lash', 17)] }),
  v160Enemy({ id: 'the_obscura', name: 'The Obscura', act: 2, role: 'normal', maxHp: 70, moves: [statusMove('illusion', 'Illusion', 'pollutionDazed', 1), attackMove('piercing-gaze', 'Piercing Gaze', 10), statusMove('sail', 'Sail', 'strength', 2, 'self'), attackBlockMove('hardening-strike', 'Hardening Strike', 10, 10)] }),
  v160Enemy({ id: 'thieving_hopper', name: 'Thieving Hopper', act: 2, role: 'normal', maxHp: 48, moves: [attackStatusMove('thievery', 'Thievery', 7, 'pollutionDazed', 1), attackMove('nab', 'Nab', 14), attackMove('hat-trick', 'Hat Trick', 11), blockMove('flutter', 'Flutter', 12)] }),
  v160Enemy({ id: 'tunneler', name: 'Tunneler', act: 2, role: 'normal', maxHp: 72, moves: [attackMove('bite', 'Bite', 11), blockMove('burrow', 'Burrow', 32), attackMove('attack-from-below', 'Attack from Below', 13)] }),
];

const v160Act2EliteEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'decimillipede_segment', name: 'Decimillipede Segment', act: 2, role: 'elite', maxHp: 46, initialStatuses: { reattach: 25 }, moves: [multiAttackMove('writhe', 'Writhe', 5, 2), statusMove('bulk', 'Bulk', 'strength', 2, 'self'), attackStatusMove('constrict', 'Constrict', 7, 'weak', 1)] }),
  v160Enemy({ id: 'entomancer', name: 'Entomancer', act: 2, role: 'elite', maxHp: 118, initialStatuses: { personalHive: 1 }, moves: [mixedMove('pheromone-spit', 'Pheromone Spit', { type: 'mixed', label: 'Hive + buff', status: { id: 'strength', amount: 2 } }, [{ type: 'applyStatus', status: 'personalHive', amount: 1, target: 'self' }, { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }]), multiAttackMove('beeeees', 'Beeeees!', 3, 6), attackMove('spear', 'Spear!', 18)] }),
  v160Enemy({ id: 'infested_prism', name: 'Infested Prism', act: 2, role: 'elite', maxHp: 104, initialStatuses: { vitalSpark: 1 }, moves: [attackMove('jab', 'Jab', 12), attackBlockMove('radiate', 'Radiate', 16, 16), multiAttackMove('whirlwind', 'Whirlwind', 5, 3), mixedMove('pulsate', 'Pulsate', { type: 'mixed', label: 'Block + buff', block: 10, status: { id: 'strength', amount: 2 } }, [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }, { type: 'block', amount: 10, target: 'self' }])] }),
];

const v160Act2BossEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'knowledge_demon', name: 'Knowledge Demon', act: 2, role: 'boss', maxHp: 280, moves: [statusMove('curse-of-knowledge', 'Curse of Knowledge', 'pollutionDazed', 2), attackMove('slap', 'Slap', 17), multiAttackMove('knowledge-overwhelming', 'Knowledge Overwhelming', 7, 3), mixedMove('runes', 'Runes', { type: 'mixed', label: 'Heal marker + buff', status: { id: 'strength', amount: 2 } }, [{ type: 'applyStatus', status: 'regen', amount: 6, target: 'self' }, { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }])] }),
  v160Enemy({ id: 'the_insatiable', name: 'The Insatiable', act: 2, role: 'boss', maxHp: 255, initialStatuses: { sandpit: 4 }, moves: [statusMove('liquify-ground', 'Liquify Ground', 'pollutionDazed', 6), multiAttackMove('thrash', 'Thrash', 8, 2), attackMove('lunging-bite', 'Lunging Bite', 28)] }),
  v160Enemy({ id: 'kaiser_crab_crusher', name: 'Kaiser Crab Crusher', act: 2, role: 'boss', maxHp: 199, moves: [attackMove('thrash', 'Thrash', 12), attackMove('enlarging-strike', 'Enlarging Strike', 14), multiStatusMove('bug-sting', 'Bug Sting', 6, 2, 'weak', 2), statusMove('crush-frail', 'Crush Frail', 'frail', 2)] }),
  v160Enemy({ id: 'kaiser_crab_rocket', name: 'Kaiser Crab Rocket', act: 2, role: 'boss', maxHp: 189, moves: [attackMove('targeting-reticle', 'Targeting Reticle', 3), attackMove('precision-beam', 'Precision Beam', 18), statusMove('charge-up', 'Charge Up', 'strength', 2, 'self'), attackMove('laser', 'Laser', 20)] }),
];

const v160Act3NormalEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'axebot', name: 'Axebot', act: 3, role: 'normal', maxHp: 72, initialStatuses: { stock: 1 }, moves: [mixedMove('boot-up', 'Boot Up', { type: 'mixed', label: 'Block + buff', block: 10, status: { id: 'strength', amount: 1 } }, [{ type: 'block', amount: 10, target: 'self' }, { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' }]), multiAttackMove('one-two', 'The One-Two', 7, 2), statusMove('sharpen', 'Sharpen', 'strength', 4, 'self'), attackStatusMove('hammer-uppercut', 'Hammer Uppercut', 11, 'weak', 1), statusMove('hammer-frail', 'Hammer Frail', 'frail', 1)] }),
  v160Enemy({ id: 'calcified_cultist', name: 'Calcified Cultist', act: 3, role: 'normal', maxHp: 58, moves: [statusMove('incantation', 'Incantation', 'ritual', 2, 'self'), attackMove('dark-strike', 'Dark Strike', 9)] }),
  v160Enemy({ id: 'damp_cultist', name: 'Damp Cultist', act: 3, role: 'normal', maxHp: 64, moves: [statusMove('incantation', 'Incantation', 'ritual', 5, 'self'), attackMove('dark-strike', 'Dark Strike', 8)] }),
  v160Enemy({ id: 'devoted_sculptor', name: 'Devoted Sculptor', act: 3, role: 'normal', maxHp: 88, initialStatuses: { ritual: 8 }, moves: [multiAttackMove('savage', 'Savage', 6, 2)] }),
  v160Enemy({ id: 'fabricator', name: 'Fabricator', act: 3, role: 'normal', maxHp: 90, moves: [statusMove('fabricate', 'Fabricate', 'spawned', 1, 'self'), attackSelfStatusMove('fabricating-strike', 'Fabricating Strike', 18, 'spawned', 1), attackMove('disintegrate', 'Disintegrate', 31)] }),
  v160Enemy({ id: 'guardbot', name: 'Guardbot', act: 3, role: 'summon', maxHp: 35, moves: [blockMove('guard', 'Guard', 15)] }),
  v160Enemy({ id: 'stabbot', name: 'Stabbot', act: 3, role: 'summon', maxHp: 31, moves: [attackStatusMove('stab', 'Stab', 11, 'frail', 1)] }),
  v160Enemy({ id: 'zapbot', name: 'Zapbot', act: 3, role: 'summon', maxHp: 28, moves: [attackMove('zap', 'Zap', 14)] }),
  v160Enemy({ id: 'noisebot', name: 'Noisebot', act: 3, role: 'summon', maxHp: 30, moves: [statusMove('noise', 'Noise', 'pollutionDazed', 1)] }),
  v160Enemy({ id: 'frog_knight', name: 'Frog Knight', act: 3, role: 'normal', maxHp: 86, initialStatuses: { plating: 15 }, moves: [attackStatusMove('tongue-lash', 'Tongue Lash', 13, 'frail', 2), attackMove('strike-down-evil', 'Strike Down Evil', 21), statusMove('for-the-queen', 'For the Queen', 'strength', 5, 'self'), attackMove('beetle-charge', 'Beetle Charge', 25)] }),
  v160Enemy({ id: 'globe_head', name: 'Globe Head', act: 3, role: 'normal', maxHp: 76, initialStatuses: { galvanic: 6 }, moves: [multiAttackMove('thunder-strike', 'Thunder Strike', 6, 3), attackStatusMove('shocking-slap', 'Shocking Slap', 13, 'frail', 2), attackSelfStatusMove('galvanic-burst', 'Galvanic Burst', 16, 'strength', 2)] }),
  v160Enemy({ id: 'living_shield', name: 'Living Shield', act: 3, role: 'normal', maxHp: 92, moves: [attackMove('shield-slam', 'Shield Slam', 9), attackSelfStatusMove('smash', 'Smash', 16, 'strength', 3)] }),
  v160Enemy({ id: 'owl_magistrate', name: 'Owl Magistrate', act: 3, role: 'normal', maxHp: 140, moves: [attackMove('scrutiny', 'Scrutiny', 16), multiAttackMove('peck-assault', 'Peck Assault', 2, 6), statusMove('judicial-flight', 'Judicial Flight', 'strength', 2, 'self'), attackStatusMove('verdict', 'Verdict', 26, 'vulnerable', 3)] }),
  v160Enemy({ id: 'scroll_of_biting', name: 'Scroll of Biting', act: 3, role: 'normal', maxHp: 32, initialStatuses: { paperCuts: 2 }, moves: [attackMove('chomp', 'Chomp', 14), multiAttackMove('chew', 'Chew', 6, 2), statusMove('more-teeth', 'More Teeth', 'strength', 2, 'self')] }),
  v160Enemy({ id: 'slimed_berserker', name: 'Slimed Berserker', act: 3, role: 'normal', maxHp: 150, moves: [statusMove('vomit-ichor', 'Vomit Ichor', 'pollutionSlimed', 3), multiAttackMove('furious-pummeling', 'Furious Pummeling', 4, 6), attackSelfStatusMove('leeching-hug', 'Leeching Hug', 8, 'strength', 3), statusMove('leeching-weak', 'Leeching Weak', 'weak', 1), attackMove('smother', 'Smother', 30)] }),
  v160Enemy({ id: 'the_forgotten', name: 'The Forgotten', act: 3, role: 'normal', maxHp: 74, moves: [mixedMove('miasma', 'Miasma', { type: 'mixed', label: 'Block + status', block: 8, status: { id: 'dexterity', amount: 2 } }, [{ type: 'block', amount: 8, target: 'self' }, { type: 'applyStatus', status: 'dexterity', amount: 2, target: 'self' }, { type: 'applyStatus', status: 'weak', amount: 1, target: 'player' }]), attackMove('dread', 'Dread', 15)] }),
  v160Enemy({ id: 'the_lost', name: 'The Lost', act: 3, role: 'normal', maxHp: 70, moves: [mixedMove('debilitating-smog', 'Debilitating Smog', { type: 'mixed', label: 'Status + buff', status: { id: 'weak', amount: 1 } }, [{ type: 'applyStatus', status: 'weak', amount: 1, target: 'player' }, { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }]), multiAttackMove('eye-lasers', 'Eye Lasers', 7, 2)] }),
  v160Enemy({ id: 'turret_operator', name: 'Turret Operator', act: 3, role: 'normal', maxHp: 68, moves: [multiAttackMove('unload', 'Unload', 4, 5), statusMove('reload', 'Reload', 'strength', 11, 'self')] }),
  v160Enemy({ id: 'cubex_construct_overgrowth', name: 'Cubex Construct', act: 3, role: 'normal', maxHp: 72, initialStatuses: { artifact: 1 }, moves: [statusMove('charge-up', 'Charge Up', 'strength', 2, 'self'), attackSelfStatusMove('expel-blast', 'Expel Blast', 12, 'strength', 2), multiAttackMove('multi-attack', 'Multi Attack', 6, 3)] }),
];

const v160Act3EliteEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'flail_knight', name: 'Flail Knight', act: 3, role: 'elite', maxHp: 101, moves: [statusMove('war-chant', 'War Chant', 'strength', 3, 'self'), multiAttackMove('flail', 'Flail', 9, 2), attackMove('ram', 'Ram', 15)] }),
  v160Enemy({ id: 'spectral_knight', name: 'Spectral Knight', act: 3, role: 'elite', maxHp: 93, moves: [statusMove('hex', 'Hex', 'weak', 2), attackMove('soul-slash', 'Soul Slash', 15), multiAttackMove('soul-flame', 'Soul Flame', 3, 3)] }),
  v160Enemy({ id: 'magi_knight', name: 'Magi Knight', act: 3, role: 'elite', maxHp: 82, moves: [statusMove('dampen', 'Dampen', 'frail', 2), blockMove('prep', 'Prep', 5), attackMove('magic-bomb', 'Magic Bomb', 35)] }),
  v160Enemy({ id: 'mecha_knight', name: 'Mecha Knight', act: 3, role: 'elite', maxHp: 165, initialStatuses: { artifact: 3 }, moves: [attackMove('charge', 'Charge', 25), statusMove('flamethrower', 'Flamethrower', 'pollutionBurn', 4), mixedMove('windup', 'Windup', { type: 'mixed', label: 'Block + buff', block: 15, status: { id: 'strength', amount: 5 } }, [{ type: 'block', amount: 15, target: 'self' }, { type: 'applyStatus', status: 'strength', amount: 5, target: 'self' }]), attackMove('heavy-cleave', 'Heavy Cleave', 45)] }),
  v160Enemy({ id: 'soul_nexus', name: 'Soul Nexus', act: 3, role: 'elite', maxHp: 150, moves: [attackMove('soul-burn-opening', 'Soul Burn', 29), multiAttackMove('maelstrom', 'Maelstrom', 6, 4), attackStatusMove('drain-life', 'Drain Life', 18, 'weak', 2), statusMove('drain-vulnerable', 'Drain Vulnerable', 'vulnerable', 2)] }),
];

const v160Act3BossEnemies: EnemyDefinition[] = [
  v160Enemy({ id: 'doormaker_door', name: 'Doormaker Door', act: 3, role: 'boss', maxHp: 155, moves: [attackMove('dramatic-open', 'Dramatic Open', 25), attackSelfStatusMove('enforce', 'Enforce', 20, 'strength', 3), multiAttackMove('door-slam', 'Door Slam', 15, 2)] }),
  v160Enemy({ id: 'doormaker', name: 'Doormaker', act: 3, role: 'boss', maxHp: 170, initialStatuses: { stun: 1 }, moves: [attackMove('beam', 'Beam', 31), attackSelfStatusMove('get-back-in', 'Get Back In', 20, 'strength', 5)] }),
  v160Enemy({ id: 'torch_head_amalgam', name: 'Torch Head Amalgam', act: 3, role: 'boss', maxHp: 199, moves: [attackMove('tackle', 'Tackle', 18), multiAttackMove('beam', 'Beam', 8, 3)] }),
  v160Enemy({ id: 'the_queen', name: 'The Queen', act: 3, role: 'boss', maxHp: 400, moves: [statusMove('puppet-strings', 'Puppet Strings', 'chainsOfBinding', 3), statusMove('your-mine-frail', 'Your Mine', 'frail', 99), statusMove('your-mine-weak', 'Your Mine Weak', 'weak', 99), statusMove('your-mine-vulnerable', 'Your Mine Vulnerable', 'vulnerable', 99), blockMove('burn-bright-for-me', 'Burn Bright for Me', 20), attackMove('off-with-your-head', 'Off with Your Head', 35)] }),
  v160Enemy({ id: 'test_subject_c10', name: 'Test Subject #C10', act: 3, role: 'boss', maxHp: 600, moves: [mixedMove('respawn', 'Respawn', { type: 'mixed', label: 'Respawn markers', status: { id: 'painfulStabs', amount: 1 } }, [{ type: 'applyStatus', status: 'painfulStabs', amount: 1, target: 'self' }, { type: 'applyStatus', status: 'nemesis', amount: 1, target: 'self' }]), attackMove('bite', 'Bite', 20), attackStatusMove('skull-bash', 'Skull Bash', 14, 'vulnerable', 2), attackMove('pounce', 'Pounce', 24), statusMove('phase-shift', 'Phase Shift', 'intangible', 1, 'self')] }),
];

export const v160NormalEnemies: EnemyDefinition[] = [
  ...v160Act1NormalEnemies,
  ...v160Act2NormalEnemies,
  ...v160Act3NormalEnemies,
];

export const v160EliteEnemies: EnemyDefinition[] = [
  ...v160Act1EliteEnemies,
  ...v160Act2EliteEnemies,
  ...v160Act3EliteEnemies,
];

export const v160BossEnemies: EnemyDefinition[] = [
  ...v160Act1BossEnemies,
  ...v160Act2BossEnemies,
  ...v160Act3BossEnemies,
];

export const normalTrainingEnemies: EnemyDefinition[] = [
  ...legacyNormalEnemies,
  ...v160NormalEnemies,
];

export const eliteEnemies: EnemyDefinition[] = [
  ...legacyEliteEnemies,
  ...v160EliteEnemies,
];

export const bossEnemies: EnemyDefinition[] = [
  ...legacyBossEnemies,
  ...v160BossEnemies,
];

export const trainingEnemies: EnemyDefinition[] = [
  ...normalTrainingEnemies,
  ...eliteEnemies,
  ...bossEnemies,
];

export const trainingEnemyById: Record<string, EnemyDefinition> = Object.fromEntries(
  trainingEnemies.map((enemy) => [enemy.id, enemy]),
);
