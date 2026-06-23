import type { GameItem, GlobalConfigValues, LevelConfig, PlayerProfile } from './types'
import { clamp, computeCultivationRate, toNumber } from './formulas'

export interface CultivationProjection {
  levelOrder: number
  xp: number
  threshold: number
  progressPct: number
  projectedLabel: string
}

export function projectCultivation(
  profile: PlayerProfile,
  levels: LevelConfig[],
  method: GameItem,
  globalConfig: GlobalConfigValues,
  now = new Date(),
): CultivationProjection {
  const levelMap = new Map(levels.map((level) => [level.level_order, level]))
  let levelOrder = profile.level_order
  let xp = toNumber(profile.cultivation_xp)
  const current = levelMap.get(levelOrder)
  if (profile.activity_type === 'cultivating' && current) {
    const elapsed = clamp(
      (now.getTime() - new Date(profile.last_settled_at).getTime()) / 1000,
      0,
      globalConfig.max_offline_seconds,
    )
    xp += elapsed * computeCultivationRate(current, method, globalConfig)
    while (levelOrder < 107) {
      const level = levelMap.get(levelOrder)
      if (!level || xp < level.threshold) break
      xp -= level.threshold
      levelOrder += 1
    }
  }
  const projectedLevel = levelMap.get(levelOrder) ?? current ?? levels[0]
  const threshold = projectedLevel?.threshold ?? 1
  if (levelOrder >= 107) {
    xp = Math.min(xp, threshold)
  }
  return {
    levelOrder,
    xp,
    threshold,
    progressPct: clamp(xp / Math.max(1, threshold), 0, 1),
    projectedLabel: projectedLevel?.label ?? '斗之气一段',
  }
}
