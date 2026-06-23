import type { ElementKey, Grade, Tier } from './types'

export const REALMS = [
  ['dou_zhi_qi', '斗之气'],
  ['dou_zhe', '斗者'],
  ['dou_shi', '斗师'],
  ['da_dou_shi', '大斗师'],
  ['dou_ling', '斗灵'],
  ['dou_wang', '斗王'],
  ['dou_huang', '斗皇'],
  ['dou_zong', '斗宗'],
  ['dou_zun', '斗尊'],
  ['ban_sheng', '半圣'],
  ['dou_sheng', '斗圣'],
  ['dou_di', '斗帝'],
] as const

export const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

export const TIER_LABEL: Record<Tier, string> = {
  huang: '黄阶',
  xuan: '玄阶',
  di: '地阶',
  tian: '天阶',
}

export const GRADE_LABEL: Record<Grade, string> = {
  low: '低级',
  mid: '中级',
  high: '高级',
}

export const ELEMENT_LABEL: Record<ElementKey, string> = {
  none: '无',
  fire: '火',
  water: '水',
  wind: '风',
  thunder: '雷',
  earth: '土',
  wood: '木',
  ice: '冰',
  poison: '毒',
  light: '光',
  dark: '暗',
}

export const DEFAULT_GLOBAL_CONFIG = {
  cultivation_speed_multiplier: 1,
  skill_practice_rate_per_sec: 1,
  max_offline_seconds: 86_400,
  heal_hp_pct_per_sec: 0.025,
  heal_qi_pct_per_sec: 0.04,
  passive_hp_pct_per_sec: 0.0005,
  passive_qi_pct_per_sec: 0.0008,
  auction_close_hour_local: 16,
  auction_bid_lock_minutes: 30,
  auction_min_increment_pct: 0.05,
  auction_daily_system_lot_count: 3,
  worker_income_cap_hours: 24,
  auto_cultivate_after_heal: true,
  auto_cultivate_after_chore: false,
  config_version: 1,
}

export const DEFAULT_METHOD = {
  id: 'default-method',
  item_type: 'method' as const,
  owner_id: null,
  name: '无名吐纳法',
  description: '最基础的吐纳方式。',
  tier: 'huang' as const,
  grade: 'low' as const,
  element: 'none' as const,
  speed_multiplier: 1,
  potential_multiplier: 1,
  hp_multiplier: 1,
  qi_multiplier: 1,
  attack_multiplier: 1,
  defense_multiplier: 1,
  special_effects: {},
  skill_kind: null,
  cooldown_sec: 0,
  qi_cost_pct: 0,
  power_multiplier: 1,
  effect_json: {},
  proficiency_xp: 0,
  proficiency_required: 600,
  is_basic: false,
  is_locked: false,
  disabled: false,
}
