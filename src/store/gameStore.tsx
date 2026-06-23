import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { requireSupabase } from '../lib/supabase'
import { normalizeGlobalConfigs, toNumber } from '../game/formulas'
import type {
  AuctionLot,
  BattleLogRecord,
  ChoreTemplate,
  DailyChoreRoll,
  GameItem,
  GlobalConfigValues,
  LevelConfig,
  PlayerProfile,
  Worker,
} from '../game/types'

interface GameContextValue {
  profile: PlayerProfile | null
  levels: LevelConfig[]
  globalConfig: GlobalConfigValues
  items: GameItem[]
  chores: DailyChoreRoll[]
  workers: Worker[]
  auctionLots: AuctionLot[]
  battleLogs: BattleLogRecord[]
  loading: boolean
  error: string | null
  refreshAll: () => Promise<void>
  settle: () => Promise<PlayerProfile | null>
  startActivity: (activity: string, targetId?: string | null, payload?: Record<string, unknown>) => Promise<void>
  equipMethod: (itemId: string) => Promise<void>
  updateBattleStrategy: (skillIds: string[]) => Promise<void>
  generateDailyChores: () => Promise<void>
  collectWorkerIncome: (workerId: string) => Promise<void>
  generateDailyAuctions: () => Promise<void>
  closeDueAuctions: () => Promise<void>
  placeBid: (lotId: string, amount: number) => Promise<void>
  createPlayerAuction: (itemId: string, startPrice: number) => Promise<void>
  saveBattleResult: (args: SaveBattleArgs) => Promise<void>
}

export interface SaveBattleArgs {
  opponentName: string
  result: 'win' | 'lose' | 'timeout'
  playerHpAfter: number
  playerQiAfter: number
  rewardPayload: Record<string, unknown>
  logs: unknown[]
}

const GameContext = createContext<GameContextValue | null>(null)

function normalizeProfile(row: PlayerProfile): PlayerProfile {
  return {
    ...row,
    coins: toNumber(row.coins),
    cultivation_xp: toNumber(row.cultivation_xp),
    current_hp: toNumber(row.current_hp),
    current_qi: toNumber(row.current_qi),
    battle_strategy: Array.isArray(row.battle_strategy) ? row.battle_strategy : [],
  }
}

function normalizeLevel(row: LevelConfig): LevelConfig {
  return {
    ...row,
    threshold: toNumber(row.threshold),
    base_rate_per_sec: toNumber(row.base_rate_per_sec),
    hp_base: toNumber(row.hp_base),
    qi_base: toNumber(row.qi_base),
    attack_base: toNumber(row.attack_base),
    defense_base: toNumber(row.defense_base),
  }
}

function normalizeItem(row: GameItem): GameItem {
  return {
    ...row,
    speed_multiplier: toNumber(row.speed_multiplier, 1),
    potential_multiplier: toNumber(row.potential_multiplier, 1),
    hp_multiplier: toNumber(row.hp_multiplier, 1),
    qi_multiplier: toNumber(row.qi_multiplier, 1),
    attack_multiplier: toNumber(row.attack_multiplier, 1),
    defense_multiplier: toNumber(row.defense_multiplier, 1),
    qi_cost_pct: toNumber(row.qi_cost_pct),
    power_multiplier: toNumber(row.power_multiplier, 1),
    proficiency_xp: toNumber(row.proficiency_xp),
    proficiency_required: toNumber(row.proficiency_required, 600),
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [levels, setLevels] = useState<LevelConfig[]>([])
  const [globalConfig, setGlobalConfig] = useState<GlobalConfigValues>(normalizeGlobalConfigs([]))
  const [items, setItems] = useState<GameItem[]>([])
  const [chores, setChores] = useState<DailyChoreRoll[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [auctionLots, setAuctionLots] = useState<AuctionLot[]>([])
  const [battleLogs, setBattleLogs] = useState<BattleLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshAll = useCallback(async () => {
    const client = requireSupabase()
    setLoading(true)
    setError(null)
    try {
      const userResult = await client.auth.getUser()
      if (userResult.error) throw userResult.error
      const userId = userResult.data.user?.id
      if (!userId) throw new Error('登录状态已失效')

      const [
        profileResult,
        levelsResult,
        globalsResult,
        itemsResult,
        choresResult,
        workersResult,
        lotsResult,
        logsResult,
      ] = await Promise.all([
        client.from('player_profiles').select('*').eq('id', userId).single(),
        client.from('level_configs').select('*').order('level_order'),
        client.from('global_configs').select('key,value'),
        client.from('game_items').select('*').order('created_at', { ascending: true }),
        client
          .from('daily_chore_rolls')
          .select('*, chore_templates(*)')
          .order('created_at', { ascending: false })
          .limit(10),
        client.from('workers').select('*').order('created_at', { ascending: false }),
        client
          .from('auction_lots')
          .select('*, game_items(*)')
          .order('closes_at', { ascending: true })
          .limit(30),
        client.from('battle_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ])

      for (const result of [
        profileResult,
        levelsResult,
        globalsResult,
        itemsResult,
        choresResult,
        workersResult,
        lotsResult,
        logsResult,
      ]) {
        if (result.error) throw result.error
      }

      setProfile(normalizeProfile(profileResult.data as PlayerProfile))
      setLevels((levelsResult.data ?? []).map((row) => normalizeLevel(row as LevelConfig)))
      setGlobalConfig(normalizeGlobalConfigs((globalsResult.data ?? []) as Array<{ key: string; value: unknown }>))
      setItems((itemsResult.data ?? []).map((row) => normalizeItem(row as GameItem)))
      setChores((choresResult.data ?? []) as DailyChoreRoll[])
      setWorkers((workersResult.data ?? []).map((row) => ({ ...row, efficiency: toNumber(row.efficiency, 1) })) as Worker[])
      setAuctionLots((lotsResult.data ?? []) as AuctionLot[])
      setBattleLogs((logsResult.data ?? []) as BattleLogRecord[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取游戏数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const callRpcAndRefresh = useCallback(
    async (name: string, params?: Record<string, unknown>) => {
      const { error: rpcError } = await requireSupabase().rpc(name, params)
      if (rpcError) throw rpcError
      await refreshAll()
    },
    [refreshAll],
  )

  const settle = useCallback(async () => {
    const { data, error: rpcError } = await requireSupabase().rpc('settle_self')
    if (rpcError) throw rpcError
    await refreshAll()
    return data ? normalizeProfile(data as PlayerProfile) : null
  }, [refreshAll])

  const startActivity = useCallback(
    async (activity: string, targetId: string | null = null, payload: Record<string, unknown> = {}) => {
      await callRpcAndRefresh('start_activity', {
        p_activity: activity,
        p_target_id: targetId,
        p_payload: payload,
      })
    },
    [callRpcAndRefresh],
  )

  useEffect(() => {
    void settle().catch(() => {
      void refreshAll()
    })
  }, [refreshAll, settle])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void settle()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    const heartbeat = window.setInterval(() => {
      void settle()
    }, 240_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(heartbeat)
    }
  }, [settle])

  const value = useMemo<GameContextValue>(
    () => ({
      profile,
      levels,
      globalConfig,
      items,
      chores,
      workers,
      auctionLots,
      battleLogs,
      loading,
      error,
      refreshAll,
      settle,
      startActivity,
      equipMethod: async (itemId) => {
        await callRpcAndRefresh('equip_method', { p_item_id: itemId })
      },
      updateBattleStrategy: async (skillIds) => {
        await callRpcAndRefresh('update_battle_strategy', { p_skill_ids: skillIds })
      },
      generateDailyChores: async () => {
        await callRpcAndRefresh('generate_daily_chores')
      },
      collectWorkerIncome: async (workerId) => {
        await callRpcAndRefresh('collect_worker_income', { p_worker_id: workerId })
      },
      generateDailyAuctions: async () => {
        await callRpcAndRefresh('generate_daily_auctions')
      },
      closeDueAuctions: async () => {
        await callRpcAndRefresh('close_due_auctions')
      },
      placeBid: async (lotId, amount) => {
        await callRpcAndRefresh('place_bid', { p_lot_id: lotId, p_amount: amount })
      },
      createPlayerAuction: async (itemId, startPrice) => {
        await callRpcAndRefresh('create_player_auction', { p_item_id: itemId, p_start_price: startPrice })
      },
      saveBattleResult: async (args) => {
        await callRpcAndRefresh('save_npc_battle_result', {
          p_opponent_name: args.opponentName,
          p_result: args.result,
          p_player_hp_after: args.playerHpAfter,
          p_player_qi_after: args.playerQiAfter,
          p_reward_payload: args.rewardPayload,
          p_log_json: args.logs,
        })
      },
    }),
    [
      auctionLots,
      battleLogs,
      callRpcAndRefresh,
      chores,
      error,
      globalConfig,
      items,
      levels,
      loading,
      profile,
      refreshAll,
      settle,
      startActivity,
      workers,
    ],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame() {
  const value = useContext(GameContext)
  if (!value) throw new Error('useGame must be used inside GameProvider')
  return value
}
