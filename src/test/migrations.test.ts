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
})
