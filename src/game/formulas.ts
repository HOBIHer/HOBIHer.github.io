import { CN_NUM, DEFAULT_GLOBAL_CONFIG, DEFAULT_METHOD, REALMS } from './constants'
import type {
  CombatStats,
  DamagePreview,
  GameItem,
  GlobalConfigValues,
  LevelConfig,
  Worker,
} from './types'

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export function getLevelLabel(levelOrder: number): string {
  const safeLevel = clamp(Math.floor(levelOrder), 0, 107)
  const realmIndex = Math.floor(safeLevel / 9)
  const subIndex = (safeLevel % 9) + 1
  const realmName = REALMS[realmIndex]?.[1] ?? REALMS[0][1]
  return realmIndex === 0
    ? `${realmName}${CN_NUM[subIndex]}段`
    : `${CN_NUM[subIndex]}星${realmName}`
}

export function computeLevelSeedConfig(realmIndex: number, subIndex: number): LevelConfig {
  const realm = REALMS[realmIndex] ?? REALMS[0]
  const levelOrder = realmIndex * 9 + (subIndex - 1)
  return {
    level_order: levelOrder,
    realm_index: realmIndex,
    sub_index: subIndex,
    realm_key: realm[0],
    realm_name: realm[1],
    label: getLevelLabel(levelOrder),
    threshold: Math.round(300 * Math.pow(3.2, realmIndex) * (1 + 0.22 * (subIndex - 1))),
    base_rate_per_sec: round4(1 * Math.pow(1.12, realmIndex) * (1 + 0.02 * (subIndex - 1))),
    hp_base: Math.round(100 * Math.pow(1.55, realmIndex) * (1 + 0.11 * (subIndex - 1))),
    qi_base: Math.round(60 * Math.pow(1.5, realmIndex) * (1 + 0.1 * (subIndex - 1))),
    attack_base: Math.round(8 * Math.pow(1.45, realmIndex) * (1 + 0.09 * (subIndex - 1))),
    defense_base: Math.round(2 * Math.pow(1.42, realmIndex) * (1 + 0.08 * (subIndex - 1))),
  }
}

export function normalizeGlobalConfigs(rows: Array<{ key: string; value: unknown }>): GlobalConfigValues {
  return rows.reduce<GlobalConfigValues>((acc, row) => {
    const key = row.key as keyof GlobalConfigValues
    if (key in acc) {
      const current = acc[key]
      const nextValue =
        typeof current === 'boolean'
          ? row.value === true || row.value === 'true'
          : toNumber(row.value, Number(current))
      return { ...acc, [key]: nextValue }
    }
    return acc
  }, { ...DEFAULT_GLOBAL_CONFIG })
}

export function getEquippedMethod(items: GameItem[], equippedMethodId: string | null): GameItem {
  return items.find((item) => item.id === equippedMethodId && item.item_type === 'method') ?? DEFAULT_METHOD
}

export function computeStats(levelConfig: LevelConfig, method: Partial<GameItem> = DEFAULT_METHOD): CombatStats {
  return {
    maxHp: Math.max(1, Math.floor(toNumber(levelConfig.hp_base, 100) * toNumber(method.hp_multiplier, 1))),
    maxQi: Math.max(1, Math.floor(toNumber(levelConfig.qi_base, 60) * toNumber(method.qi_multiplier, 1))),
    attack: Math.max(1, Math.floor(toNumber(levelConfig.attack_base, 8) * toNumber(method.attack_multiplier, 1))),
    defense: Math.max(0, Math.floor(toNumber(levelConfig.defense_base, 2) * toNumber(method.defense_multiplier, 1))),
  }
}

export function computeCultivationRate(
  levelConfig: LevelConfig,
  method: Partial<GameItem> = DEFAULT_METHOD,
  globalConfig: Partial<GlobalConfigValues> = DEFAULT_GLOBAL_CONFIG,
): number {
  return (
    toNumber(levelConfig.base_rate_per_sec, 1) *
    toNumber(method.speed_multiplier, 1) *
    toNumber(method.potential_multiplier, 1) *
    toNumber(globalConfig.cultivation_speed_multiplier, 1)
  )
}

export function computePracticeProgress(skill: Pick<GameItem, 'proficiency_xp' | 'proficiency_required'>) {
  const pct = clamp(toNumber(skill.proficiency_xp) / Math.max(1, toNumber(skill.proficiency_required, 600)), 0, 1)
  const stage =
    pct >= 1 ? '化境' : pct >= 0.75 ? '圆满' : pct >= 0.5 ? '大成' : pct >= 0.25 ? '小成' : '入门'
  return {
    pct,
    stage,
    factor: 0.4 + 0.6 * pct,
  }
}

export function computeSkillDamagePreview(
  attackerStats: CombatStats,
  defenderStats: Pick<CombatStats, 'defense'>,
  skill: GameItem,
  method: Partial<GameItem> = DEFAULT_METHOD,
): DamagePreview {
  const progress = computePracticeProgress(skill)
  const elementBonus =
    method.element && skill.element && method.element !== 'none' && method.element === skill.element ? 1.08 : 1
  const rawDamage = attackerStats.attack * toNumber(skill.power_multiplier, 1) * progress.factor * elementBonus
  const afterDefense = Math.max(1, Math.floor(rawDamage - defenderStats.defense))
  const qiCost = Math.floor(attackerStats.maxQi * toNumber(skill.qi_cost_pct))
  const effect = skill.skill_kind ?? 'normal_attack'
  const note =
    effect === 'crit_strike'
      ? '含暴击期望'
      : effect === 'bleed'
        ? '附带流血'
        : effect === 'instant_damage'
          ? '直接伤害'
          : '基础攻击'
  return {
    skillName: skill.name,
    damage: afterDefense,
    qiCost,
    cooldown: toNumber(skill.cooldown_sec),
    note,
  }
}

export function computeWorkerIncome(worker: Worker, now = new Date(), capHours = 24): number {
  const last = new Date(worker.last_collected_at).getTime()
  const elapsedHours = clamp((now.getTime() - last) / 3_600_000, 0, capHours)
  const workerRealmIndex = Math.floor(toNumber(worker.level_order) / 9)
  const perHour = Math.floor(2 * Math.pow(1.18, workerRealmIndex) * toNumber(worker.efficiency, 1))
  return Math.floor(perHour * elapsedHours)
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
  }).format(value)
}
