import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readMigration(name: string) {
  return readFileSync(resolve(root, 'supabase', 'migrations', name), 'utf8')
}

describe('supabase migrations', () => {
  it('declares required public tables and RLS policies', () => {
    const schema = readMigration('001_schema.sql')
    const rls = readMigration('002_rls.sql')
    const tables = [
      'player_profiles',
      'level_configs',
      'global_configs',
      'game_items',
      'chore_templates',
      'daily_chore_rolls',
      'workers',
      'auction_lots',
      'auction_bids',
      'battle_logs',
    ]

    for (const table of tables) {
      expect(schema).toContain(`create table if not exists public.${table}`)
      expect(rls).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('contains required RPC entry points', () => {
    const functions = readMigration('003_functions.sql')
    for (const fn of [
      'handle_new_user',
      'settle_self',
      'start_activity',
      'equip_method',
      'update_battle_strategy',
      'generate_daily_chores',
      'collect_worker_income',
      'generate_daily_auctions',
      'place_bid',
      'close_due_auctions',
      'create_player_auction',
      'save_npc_battle_result',
      'admin_cancel_auction',
    ]) {
      expect(functions).toContain(`function public.${fn}`)
    }
  })

  it('seeds 12 realms, 9 sublevels, and content pools', () => {
    const seed = readMigration('004_seed.sql')
    expect(seed.match(/\(\d+, '[a-z_]+',/g)?.length).toBe(12)
    expect(seed).toContain('select generate_series(1, 9)')
    expect(seed).toContain('with method_seed')
    expect(seed).toContain('with skill_seed')
    expect(seed).toContain('with chore_seed')
  })

  it('keeps recovery and level-up migration available for deployed projects', () => {
    const migration = readMigration('005_recovery_and_levelup.sql')
    expect(migration).toContain('passive_hp_pct_per_sec')
    expect(migration).toContain('passive_qi_pct_per_sec')
    expect(migration).toContain('v_level_order > v_start_level_order')
    expect(migration).toContain('v_hp := v_max_hp')
    expect(migration).toContain('v_qi := v_max_qi')
  })

  it('keeps water rewards behind the service layer with idempotent RPCs', () => {
    const migration = readMigration('006_water_rewards.sql')
    const tables = [
      'water_devices',
      'water_reward_catalog',
      'water_coupons',
      'water_api_requests',
      'water_admin_audit',
    ]

    for (const table of tables) {
      expect(migration).toContain(`create table if not exists public.${table}`)
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`)
    }

    for (const fn of [
      'water_register_device',
      'water_get_state',
      'water_add_water',
      'water_list_coupons',
      'water_request_redeem',
      'water_admin_mark_redeemed',
    ]) {
      expect(migration).toContain(`function public.${fn}`)
    }

    expect(migration).toContain('p_request_id uuid')
    expect(migration).toContain('for update')
    expect(migration).toContain('grant execute on function public.water_add_water')
  })

  it('seeds the fixed cash pool and enforces the two-bottle daily limit', () => {
    const migration = readMigration('006_water_rewards.sql')
    const seededRewards = [...migration.matchAll(
      /\('((?:cash_\d+)|super_mystery)',\s*'[^']+',\s*'[^']*',\s*(\d+),\s*true,\s*\d+\)/g,
    )].map((match) => ({ key: match[1], weight: Number(match[2]) }))
    const weights = Object.fromEntries(seededRewards.map(({ key, weight }) => [key, weight]))

    expect(seededRewards.map(({ key }) => key)).toEqual([
      'cash_10',
      'cash_20',
      'cash_30',
      'cash_50',
      'cash_66',
      'cash_88',
      'cash_100',
      'cash_200',
      'cash_520',
      'super_mystery',
    ])
    expect(weights).toEqual({
      cash_10: 3000,
      cash_20: 2500,
      cash_30: 1800,
      cash_50: 1300,
      cash_66: 700,
      cash_88: 400,
      cash_100: 200,
      cash_200: 70,
      cash_520: 29,
      super_mystery: 1,
    })
    expect(seededRewards.reduce((sum, reward) => sum + reward.weight, 0)).toBe(10_000)
    expect(weights.cash_520).toBe(29)
    expect(weights.super_mystery).toBe(1)

    expect(migration).toContain("'dailyBottleLimit', 2")
    expect(migration).toContain("'dailyLimitReached', p_device.daily_total_ml >= 2000")
    expect(migration).toContain("'remainingDailyMl', greatest(0, 2000")
    expect(migration).toContain('WATER_DAILY_BOTTLE_LIMIT_REACHED')
    expect(migration).toContain('v_applied_amount_ml := least(')
    expect(migration).toContain('(2000 - v_device.daily_total_ml)::integer')
    expect(migration).toContain("'appliedAmountMl', v_applied_amount_ml")

    expect(migration).toContain('function public.water_fixed_cash_amount')
    expect(migration).toContain("when 'cash_520' then 520")
    expect(migration).toContain("'redeemedAmount'")
    expect(migration).toContain("and c.status = 'redeemed'")
    expect(migration).toContain('water_coupons_device_redeemed_idx')
  })
})
