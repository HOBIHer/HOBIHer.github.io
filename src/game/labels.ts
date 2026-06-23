import { ELEMENT_LABEL, GRADE_LABEL, TIER_LABEL } from './constants'
import type { ActivityType, ChoreQuality, ElementKey, Grade, Tier } from './types'

export function tierGradeLabel(tier: Tier, grade: Grade): string {
  return `${TIER_LABEL[tier]}${GRADE_LABEL[grade]}`
}

export function elementLabel(element: ElementKey): string {
  return ELEMENT_LABEL[element] ?? element
}

export function activityLabel(activity: ActivityType): string {
  return {
    idle: '空闲',
    cultivating: '修炼',
    practicing_skill: '熟练斗技',
    doing_chore: '杂工',
    healing: '疗伤',
    captured_working: '被俘打工',
  }[activity]
}

export function qualityLabel(quality: ChoreQuality): string {
  return {
    common: '凡品',
    good: '良品',
    rare: '上品',
    epic: '珍品',
    legendary: '奇遇',
  }[quality]
}
