export type ActivityType =
  | 'idle'
  | 'cultivating'
  | 'practicing_skill'
  | 'doing_chore'
  | 'healing'
  | 'captured_working'

export type ItemType = 'method' | 'skill'
export type Tier = 'huang' | 'xuan' | 'di' | 'tian'
export type Grade = 'low' | 'mid' | 'high'
export type ElementKey =
  | 'none'
  | 'fire'
  | 'water'
  | 'wind'
  | 'thunder'
  | 'earth'
  | 'wood'
  | 'ice'
  | 'poison'
  | 'light'
  | 'dark'

export type AuctionStatus = 'active' | 'closed' | 'expired' | 'cancelled'
export type ChoreQuality = 'common' | 'good' | 'rare' | 'epic' | 'legendary'

export interface PlayerProfile {
  id: string
  username: string
  display_name: string | null
  is_admin: boolean
  coins: number
  level_order: number
  cultivation_xp: number
  current_hp: number
  current_qi: number
  equipped_method_id: string | null
  battle_strategy: string[]
  activity_type: ActivityType
  activity_target_id: string | null
  activity_payload: Record<string, unknown>
  activity_started_at: string
  last_settled_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface LevelConfig {
  level_order: number
  realm_index: number
  sub_index: number
  realm_key: string
  realm_name: string
  label: string
  threshold: number
  base_rate_per_sec: number
  hp_base: number
  qi_base: number
  attack_base: number
  defense_base: number
}

export interface GameItem {
  id: string
  item_type: ItemType
  owner_id: string | null
  name: string
  description: string
  tier: Tier
  grade: Grade
  element: ElementKey
  speed_multiplier: number
  potential_multiplier: number
  hp_multiplier: number
  qi_multiplier: number
  attack_multiplier: number
  defense_multiplier: number
  special_effects: Record<string, unknown>
  skill_kind: string | null
  cooldown_sec: number
  qi_cost_pct: number
  power_multiplier: number
  effect_json: Record<string, unknown>
  proficiency_xp: number
  proficiency_required: number
  is_basic: boolean
  is_locked: boolean
  disabled: boolean
}

export interface GlobalConfigValues {
  cultivation_speed_multiplier: number
  skill_practice_rate_per_sec: number
  max_offline_seconds: number
  heal_hp_pct_per_sec: number
  heal_qi_pct_per_sec: number
  auction_close_hour_local: number
  auction_bid_lock_minutes: number
  auction_min_increment_pct: number
  auction_daily_system_lot_count: number
  worker_income_cap_hours: number
  auto_cultivate_after_heal: boolean
  auto_cultivate_after_chore: boolean
  config_version: number
}

export interface ChoreTemplate {
  id: string
  name: string
  description: string
  quality: ChoreQuality
  min_level_order: number
  duration_minutes: number
  success_rate: number
  base_reward: number
  weight: number
  disabled: boolean
}

export interface DailyChoreRoll {
  id: string
  user_id: string
  local_day: string
  template_id: string
  status: 'available' | 'in_progress' | 'success' | 'failed' | 'expired'
  started_at: string | null
  completed_at: string | null
  reward: number
  result_payload: Record<string, unknown>
  created_at: string
  chore_templates?: ChoreTemplate
}

export interface Worker {
  id: string
  owner_id: string
  name: string
  source: 'npc' | 'player'
  captured_user_id: string | null
  level_order: number
  realm_label: string
  efficiency: number
  active: boolean
  last_collected_at: string
  created_at: string
}

export interface AuctionLot {
  id: string
  local_day: string
  item_id: string
  seller_id: string | null
  source: 'system' | 'player'
  status: AuctionStatus
  start_price: number
  current_bid: number | null
  current_bidder_id: string | null
  last_bid_at: string | null
  closes_at: string
  created_at: string
  updated_at: string
  game_items?: GameItem
}

export interface BattleLogRecord {
  id: string
  user_id: string
  opponent_type: string
  opponent_name: string
  result: 'win' | 'lose' | 'timeout'
  player_hp_after: number
  player_qi_after: number
  reward_payload: Record<string, unknown>
  log_json: unknown[]
  created_at: string
}

export interface CombatStats {
  maxHp: number
  maxQi: number
  attack: number
  defense: number
}

export interface DamagePreview {
  skillName: string
  damage: number
  qiCost: number
  cooldown: number
  note: string
}
