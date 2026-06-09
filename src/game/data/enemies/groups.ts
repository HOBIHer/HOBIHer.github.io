import { randomInt, normalizeSeed } from '../../rng';
import type { MapNodeType } from '../../types';

export interface EnemyGroupDefinition {
  id: string;
  name: string;
  lowProfileName: string;
  nodeType: Exclude<MapNodeType, 'rest'>;
  enemyIds: string[];
  weight: number;
}

export const enemyGroups: EnemyGroupDefinition[] = [
  {
    id: 'training_single',
    name: '单体训练',
    lowProfileName: '单项测试',
    nodeType: 'combat',
    enemyIds: ['training_dummy'],
    weight: 5,
  },
  {
    id: 'rust_scout_single',
    name: '锈刃巡查',
    lowProfileName: '外部事项',
    nodeType: 'combat',
    enemyIds: ['rust_scout'],
    weight: 4,
  },
  {
    id: 'stone_clerk_single',
    name: '石簿归档',
    lowProfileName: '归档事项',
    nodeType: 'combat',
    enemyIds: ['stone_clerk'],
    weight: 4,
  },
  {
    id: 'dock_maintenance_pair',
    name: '港口维护组',
    lowProfileName: '维护组合',
    nodeType: 'combat',
    enemyIds: ['harbor_mender', 'rust_scout'],
    weight: 3,
  },
  {
    id: 'archive_pair',
    name: '档案双人组',
    lowProfileName: '记录组合',
    nodeType: 'combat',
    enemyIds: ['stone_clerk', 'brass_scribe'],
    weight: 3,
  },
  {
    id: 'coil_meter_pair',
    name: '线圈量表组',
    lowProfileName: '指标组合',
    nodeType: 'combat',
    enemyIds: ['coil_picker', 'glass_meter'],
    weight: 3,
  },
  {
    id: 'ash_bailiff_single',
    name: '灰印差役',
    lowProfileName: '催办事项',
    nodeType: 'combat',
    enemyIds: ['ash_bailiff'],
    weight: 2,
  },
  {
    id: 'salt_runner_patrol',
    name: '盐线巡行',
    lowProfileName: '移动组合',
    nodeType: 'combat',
    enemyIds: ['salt_runner', 'training_dummy'],
    weight: 2,
  },
  {
    id: 'iron_beadle_elite',
    name: '铁铃执事',
    lowProfileName: '高优先级事项',
    nodeType: 'elite',
    enemyIds: ['iron_beadle'],
    weight: 3,
  },
  {
    id: 'gear_cantor_elite',
    name: '齿轮领唱者',
    lowProfileName: '同步事项',
    nodeType: 'elite',
    enemyIds: ['gear_cantor'],
    weight: 2,
  },
  {
    id: 'ledger_knight_elite',
    name: '账甲骑士',
    lowProfileName: '复核事项',
    nodeType: 'elite',
    enemyIds: ['ledger_knight'],
    weight: 2,
  },
  {
    id: 'cinder_notary_elite',
    name: '余烬公证人',
    lowProfileName: '确认事项',
    nodeType: 'elite',
    enemyIds: ['cinder_notary'],
    weight: 2,
  },
  {
    id: 'bell_tower_guardian_boss',
    name: '钟塔守卫',
    lowProfileName: '最终议题',
    nodeType: 'boss',
    enemyIds: ['bell_tower_guardian'],
    weight: 1,
  },
  {
    id: 'tide_archive_prime_boss',
    name: '潮档主机',
    lowProfileName: '终局档案',
    nodeType: 'boss',
    enemyIds: ['tide_archive_prime'],
    weight: 1,
  },
];

export const enemyGroupById: Record<string, EnemyGroupDefinition> = Object.fromEntries(
  enemyGroups.map((group) => [group.id, group]),
);

export function getEnemyGroupsForNodeType(
  nodeType: EnemyGroupDefinition['nodeType'],
): EnemyGroupDefinition[] {
  return enemyGroups.filter((group) => group.nodeType === nodeType);
}

export function selectEnemyGroup(
  nodeType: EnemyGroupDefinition['nodeType'],
  seed: string | number,
): EnemyGroupDefinition {
  const candidates = getEnemyGroupsForNodeType(nodeType);
  if (candidates.length === 0) {
    throw new Error(`No enemy group for node type: ${nodeType}`);
  }

  const totalWeight = candidates.reduce((total, group) => total + Math.max(0, group.weight), 0);
  if (totalWeight <= 0) {
    return candidates[0];
  }

  const random = randomInt(normalizeSeed(String(seed)), totalWeight);
  let cursor = random.value;

  for (const group of candidates) {
    cursor -= Math.max(0, group.weight);
    if (cursor < 0) {
      return group;
    }
  }

  return candidates[candidates.length - 1];
}
