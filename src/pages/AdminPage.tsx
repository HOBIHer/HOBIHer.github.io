import { FormEvent, useEffect, useState } from 'react'
import { Save, Shield, Trash2 } from 'lucide-react'
import { requireSupabase } from '../lib/supabase'
import { useGame } from '../store/gameStore'
import type { AuctionLot, ChoreTemplate, GameItem, LevelConfig, PlayerProfile } from '../game/types'

type AdminTab = 'players' | 'levels' | 'configs' | 'items' | 'chores' | 'auctions'

export function AdminPage() {
  const { profile, closeDueAuctions } = useGame()
  const [tab, setTab] = useState<AdminTab>('players')
  const [players, setPlayers] = useState<PlayerProfile[]>([])
  const [levels, setLevels] = useState<LevelConfig[]>([])
  const [configs, setConfigs] = useState<Array<{ key: string; value: unknown; description: string | null }>>([])
  const [items, setItems] = useState<GameItem[]>([])
  const [chores, setChores] = useState<ChoreTemplate[]>([])
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadAdminData() {
    if (!profile?.is_admin) return
    setError(null)
    try {
      const client = requireSupabase()
      const [playersRes, levelsRes, configsRes, itemsRes, choresRes, lotsRes] = await Promise.all([
        client.from('player_profiles').select('*').order('created_at', { ascending: false }).limit(50),
        client.from('level_configs').select('*').order('level_order'),
        client.from('global_configs').select('*').order('key'),
        client.from('game_items').select('*').order('created_at', { ascending: false }).limit(80),
        client.from('chore_templates').select('*').order('created_at', { ascending: false }),
        client.from('auction_lots').select('*, game_items(*)').order('closes_at', { ascending: false }).limit(50),
      ])
      for (const result of [playersRes, levelsRes, configsRes, itemsRes, choresRes, lotsRes]) {
        if (result.error) throw result.error
      }
      setPlayers((playersRes.data ?? []) as PlayerProfile[])
      setLevels((levelsRes.data ?? []) as LevelConfig[])
      setConfigs((configsRes.data ?? []) as Array<{ key: string; value: unknown; description: string | null }>)
      setItems((itemsRes.data ?? []) as GameItem[])
      setChores((choresRes.data ?? []) as ChoreTemplate[])
      setLots((lotsRes.data ?? []) as AuctionLot[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '后台数据读取失败')
    }
  }

  useEffect(() => {
    void loadAdminData()
  }, [profile?.is_admin])

  if (!profile?.is_admin) {
    return (
      <section className="page-stack">
        <div className="notice notice--danger">
          <Shield size={16} /> 无后台权限
        </div>
      </section>
    )
  }

  async function updateLevel(level: LevelConfig) {
    const client = requireSupabase()
    const { error: updateError } = await client
      .from('level_configs')
      .update({
        threshold: Number(level.threshold),
        base_rate_per_sec: Number(level.base_rate_per_sec),
        hp_base: Number(level.hp_base),
        qi_base: Number(level.qi_base),
        attack_base: Number(level.attack_base),
        defense_base: Number(level.defense_base),
      })
      .eq('level_order', level.level_order)
    if (updateError) throw updateError
    await loadAdminData()
  }

  async function updateConfig(key: string, value: string) {
    const parsed = parseConfigValue(value)
    const { error: updateError } = await requireSupabase().from('global_configs').update({ value: parsed }).eq('key', key)
    if (updateError) throw updateError
    await loadAdminData()
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const itemType = String(form.get('item_type'))
    const { error: insertError } = await requireSupabase().from('game_items').insert({
      item_type: itemType,
      name: String(form.get('name')),
      description: String(form.get('description') ?? ''),
      tier: String(form.get('tier')),
      grade: String(form.get('grade')),
      element: String(form.get('element')),
      skill_kind: itemType === 'skill' ? String(form.get('skill_kind') || 'instant_damage') : null,
      speed_multiplier: Number(form.get('speed_multiplier') || 1),
      power_multiplier: Number(form.get('power_multiplier') || 1),
    })
    if (insertError) throw insertError
    event.currentTarget.reset()
    await loadAdminData()
  }

  async function createChore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const { error: insertError } = await requireSupabase().from('chore_templates').insert({
      name: String(form.get('name')),
      description: String(form.get('description') ?? ''),
      quality: String(form.get('quality')),
      min_level_order: Number(form.get('min_level_order') || 0),
      duration_minutes: Number(form.get('duration_minutes') || 5),
      success_rate: Number(form.get('success_rate') || 0.95),
      base_reward: Number(form.get('base_reward') || 10),
      weight: Number(form.get('weight') || 1),
    })
    if (insertError) throw insertError
    event.currentTarget.reset()
    await loadAdminData()
  }

  async function deleteRow(table: string, id: string) {
    const { error: deleteError } = await requireSupabase().from(table).delete().eq('id', id)
    if (deleteError) throw deleteError
    await loadAdminData()
  }

  async function updateItem(item: GameItem) {
    const { error: updateError } = await requireSupabase()
      .from('game_items')
      .update({
        name: item.name,
        description: item.description,
        tier: item.tier,
        grade: item.grade,
        element: item.element,
        speed_multiplier: Number(item.speed_multiplier),
        potential_multiplier: Number(item.potential_multiplier),
        hp_multiplier: Number(item.hp_multiplier),
        qi_multiplier: Number(item.qi_multiplier),
        attack_multiplier: Number(item.attack_multiplier),
        defense_multiplier: Number(item.defense_multiplier),
        skill_kind: item.item_type === 'skill' ? item.skill_kind : null,
        cooldown_sec: Number(item.cooldown_sec),
        qi_cost_pct: Number(item.qi_cost_pct),
        power_multiplier: Number(item.power_multiplier),
        proficiency_required: Number(item.proficiency_required),
        disabled: item.disabled,
      })
      .eq('id', item.id)
    if (updateError) throw updateError
    await loadAdminData()
  }

  async function updateChore(chore: ChoreTemplate) {
    const { error: updateError } = await requireSupabase()
      .from('chore_templates')
      .update({
        name: chore.name,
        description: chore.description,
        quality: chore.quality,
        min_level_order: Number(chore.min_level_order),
        duration_minutes: Number(chore.duration_minutes),
        success_rate: Number(chore.success_rate),
        base_reward: Number(chore.base_reward),
        weight: Number(chore.weight),
        disabled: chore.disabled,
      })
      .eq('id', chore.id)
    if (updateError) throw updateError
    await loadAdminData()
  }

  async function updateLot(lot: AuctionLot) {
    const { error: updateError } = await requireSupabase()
      .from('auction_lots')
      .update({
        start_price: Number(lot.start_price),
        closes_at: lot.closes_at,
      })
      .eq('id', lot.id)
    if (updateError) throw updateError
    await loadAdminData()
  }

  async function cancelAuction(lotId: string) {
    const { error: rpcError } = await requireSupabase().rpc('admin_cancel_auction', { p_lot_id: lotId })
    if (rpcError) throw rpcError
    await loadAdminData()
  }

  return (
    <section className="page-stack">
      <div className="segmented segmented--wrap">
        {(['players', 'levels', 'configs', 'items', 'chores', 'auctions'] as AdminTab[]).map((entry) => (
          <button key={entry} className={tab === entry ? 'active' : ''} onClick={() => setTab(entry)}>
            {entry}
          </button>
        ))}
      </div>
      {error ? <div className="notice notice--danger">{error}</div> : null}

      {tab === 'players' ? (
        <section className="list-stack">
          {players.map((player) => (
            <article className="panel" key={player.id}>
              <div className="item-card__top">
                <h2>{player.username}</h2>
                <span className="badge">{player.is_admin ? 'admin' : 'player'}</span>
              </div>
              <dl className="mini-grid">
                <div>
                  <dt>灵石</dt>
                  <dd>{player.coins}</dd>
                </div>
                <div>
                  <dt>等级</dt>
                  <dd>{player.level_order + 1}</dd>
                </div>
                <div>
                  <dt>活动</dt>
                  <dd>{player.activity_type}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'levels' ? (
        <section className="list-stack">
          {levels.slice(0, 108).map((level, index) => (
            <LevelEditor
              key={level.level_order}
              level={level}
              onChange={(next) => setLevels((rows) => rows.map((row, i) => (i === index ? next : row)))}
              onSave={() => void updateLevel(level)}
            />
          ))}
        </section>
      ) : null}

      {tab === 'configs' ? (
        <section className="list-stack">
          {configs.map((config) => (
            <ConfigEditor key={config.key} config={config} onSave={(value) => void updateConfig(config.key, value)} />
          ))}
        </section>
      ) : null}

      {tab === 'items' ? (
        <section className="page-stack">
          <form className="panel stack-form" onSubmit={(event) => void createItem(event)}>
            <h2>新增物品</h2>
            <input name="name" placeholder="名称" required />
            <input name="description" placeholder="描述" />
            <div className="form-grid">
              <select name="item_type" defaultValue="method">
                <option value="method">功法</option>
                <option value="skill">斗技</option>
              </select>
              <select name="tier" defaultValue="huang">
                <option value="huang">黄阶</option>
                <option value="xuan">玄阶</option>
                <option value="di">地阶</option>
                <option value="tian">天阶</option>
              </select>
              <select name="grade" defaultValue="low">
                <option value="low">低级</option>
                <option value="mid">中级</option>
                <option value="high">高级</option>
              </select>
              <input name="element" defaultValue="none" />
              <input name="skill_kind" placeholder="skill_kind" />
              <input name="speed_multiplier" inputMode="decimal" placeholder="修炼倍率" />
              <input name="power_multiplier" inputMode="decimal" placeholder="伤害倍率" />
            </div>
            <button className="secondary-button">
              <Save size={16} /> 保存
            </button>
          </form>
          {items.map((item, index) => (
            <ItemEditor
              key={item.id}
              item={item}
              onChange={(next) => setItems((rows) => rows.map((row, i) => (i === index ? next : row)))}
              onSave={() => void updateItem(item)}
              onDelete={() => void deleteRow('game_items', item.id)}
            />
          ))}
        </section>
      ) : null}

      {tab === 'chores' ? (
        <section className="page-stack">
          <form className="panel stack-form" onSubmit={(event) => void createChore(event)}>
            <h2>新增模板</h2>
            <input name="name" placeholder="名称" required />
            <input name="description" placeholder="描述" />
            <div className="form-grid">
              <select name="quality" defaultValue="common">
                <option value="common">凡品</option>
                <option value="good">良品</option>
                <option value="rare">上品</option>
                <option value="epic">珍品</option>
                <option value="legendary">奇遇</option>
              </select>
              <input name="min_level_order" inputMode="numeric" placeholder="最低等级" />
              <input name="duration_minutes" inputMode="numeric" placeholder="分钟" />
              <input name="success_rate" inputMode="decimal" placeholder="成功率" />
              <input name="base_reward" inputMode="numeric" placeholder="奖励" />
              <input name="weight" inputMode="numeric" placeholder="权重" />
            </div>
            <button className="secondary-button">
              <Save size={16} /> 保存
            </button>
          </form>
          {chores.map((chore, index) => (
            <ChoreEditor
              key={chore.id}
              chore={chore}
              onChange={(next) => setChores((rows) => rows.map((row, i) => (i === index ? next : row)))}
              onSave={() => void updateChore(chore)}
              onDelete={() => void deleteRow('chore_templates', chore.id)}
            />
          ))}
        </section>
      ) : null}

      {tab === 'auctions' ? (
        <section className="page-stack">
          <button className="secondary-button" onClick={() => void closeDueAuctions()}>
            <Save size={16} /> 结算到期
          </button>
          {lots.map((lot, index) => (
            <AuctionLotEditor
              key={lot.id}
              lot={lot}
              onChange={(next) => setLots((rows) => rows.map((row, i) => (i === index ? next : row)))}
              onSave={() => void updateLot(lot)}
              onCancel={() => void cancelAuction(lot.id)}
            />
          ))}
        </section>
      ) : null}
    </section>
  )
}

function LevelEditor({
  level,
  onChange,
  onSave,
}: {
  level: LevelConfig
  onChange: (level: LevelConfig) => void
  onSave: () => void
}) {
  return (
    <article className="panel">
      <div className="item-card__top">
        <h2>{level.label}</h2>
        <button className="icon-button" onClick={onSave} title="保存">
          <Save size={16} />
        </button>
      </div>
      <div className="form-grid">
        {(['threshold', 'base_rate_per_sec', 'hp_base', 'qi_base', 'attack_base', 'defense_base'] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              value={String(level[key])}
              onChange={(event) => onChange({ ...level, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>
    </article>
  )
}

function ConfigEditor({
  config,
  onSave,
}: {
  config: { key: string; value: unknown; description: string | null }
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(JSON.stringify(config.value))
  useEffect(() => setValue(JSON.stringify(config.value)), [config.value])
  return (
    <article className="panel">
      <div className="item-card__top">
        <div>
          <h2>{config.key}</h2>
          <p>{config.description}</p>
        </div>
        <button className="icon-button" onClick={() => onSave(value)} title="保存">
          <Save size={16} />
        </button>
      </div>
      <input value={value} onChange={(event) => setValue(event.target.value)} />
    </article>
  )
}

function ItemEditor({
  item,
  onChange,
  onSave,
  onDelete,
}: {
  item: GameItem
  onChange: (item: GameItem) => void
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <article className="panel">
      <div className="item-card__top">
        <div>
          <h2>{item.name}</h2>
          <p>
            {item.item_type} · {item.owner_id ? '玩家持有' : '系统池'}
          </p>
        </div>
        <div className="button-row">
          <button className="icon-button" onClick={onSave} title="保存">
            <Save size={16} />
          </button>
          <button className="icon-button" onClick={onDelete} title="删除">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="stack-form">
        <input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} />
        <input value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} />
        <div className="form-grid">
          <select value={item.tier} onChange={(event) => onChange({ ...item, tier: event.target.value as GameItem['tier'] })}>
            <option value="huang">黄阶</option>
            <option value="xuan">玄阶</option>
            <option value="di">地阶</option>
            <option value="tian">天阶</option>
          </select>
          <select value={item.grade} onChange={(event) => onChange({ ...item, grade: event.target.value as GameItem['grade'] })}>
            <option value="low">低级</option>
            <option value="mid">中级</option>
            <option value="high">高级</option>
          </select>
          <input value={item.element} onChange={(event) => onChange({ ...item, element: event.target.value as GameItem['element'] })} />
          <label className="checkbox-line">
            <input type="checkbox" checked={item.disabled} onChange={(event) => onChange({ ...item, disabled: event.target.checked })} />
            禁用
          </label>
        </div>
        {item.item_type === 'method' ? (
          <div className="form-grid">
            <NumberInput label="修炼" value={item.speed_multiplier} onChange={(value) => onChange({ ...item, speed_multiplier: value })} />
            <NumberInput label="潜力" value={item.potential_multiplier} onChange={(value) => onChange({ ...item, potential_multiplier: value })} />
            <NumberInput label="血量" value={item.hp_multiplier} onChange={(value) => onChange({ ...item, hp_multiplier: value })} />
            <NumberInput label="斗气" value={item.qi_multiplier} onChange={(value) => onChange({ ...item, qi_multiplier: value })} />
            <NumberInput label="攻击" value={item.attack_multiplier} onChange={(value) => onChange({ ...item, attack_multiplier: value })} />
            <NumberInput label="防御" value={item.defense_multiplier} onChange={(value) => onChange({ ...item, defense_multiplier: value })} />
          </div>
        ) : (
          <div className="form-grid">
            <label>
              skill_kind
              <input value={item.skill_kind ?? ''} onChange={(event) => onChange({ ...item, skill_kind: event.target.value })} />
            </label>
            <NumberInput label="冷却" value={item.cooldown_sec} onChange={(value) => onChange({ ...item, cooldown_sec: value })} />
            <NumberInput label="耗气比例" value={item.qi_cost_pct} onChange={(value) => onChange({ ...item, qi_cost_pct: value })} />
            <NumberInput label="伤害倍率" value={item.power_multiplier} onChange={(value) => onChange({ ...item, power_multiplier: value })} />
            <NumberInput label="熟练需求" value={item.proficiency_required} onChange={(value) => onChange({ ...item, proficiency_required: value })} />
          </div>
        )}
      </div>
    </article>
  )
}

function ChoreEditor({
  chore,
  onChange,
  onSave,
  onDelete,
}: {
  chore: ChoreTemplate
  onChange: (chore: ChoreTemplate) => void
  onSave: () => void
  onDelete: () => void
}) {
  return (
    <article className="panel">
      <div className="item-card__top">
        <div>
          <h2>{chore.name}</h2>
          <p>{chore.quality}</p>
        </div>
        <div className="button-row">
          <button className="icon-button" onClick={onSave} title="保存">
            <Save size={16} />
          </button>
          <button className="icon-button" onClick={onDelete} title="删除">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="stack-form">
        <input value={chore.name} onChange={(event) => onChange({ ...chore, name: event.target.value })} />
        <input value={chore.description} onChange={(event) => onChange({ ...chore, description: event.target.value })} />
        <div className="form-grid">
          <select value={chore.quality} onChange={(event) => onChange({ ...chore, quality: event.target.value as ChoreTemplate['quality'] })}>
            <option value="common">凡品</option>
            <option value="good">良品</option>
            <option value="rare">上品</option>
            <option value="epic">珍品</option>
            <option value="legendary">奇遇</option>
          </select>
          <NumberInput label="最低等级" value={chore.min_level_order} onChange={(value) => onChange({ ...chore, min_level_order: value })} />
          <NumberInput label="分钟" value={chore.duration_minutes} onChange={(value) => onChange({ ...chore, duration_minutes: value })} />
          <NumberInput label="成功率" value={chore.success_rate} onChange={(value) => onChange({ ...chore, success_rate: value })} />
          <NumberInput label="奖励" value={chore.base_reward} onChange={(value) => onChange({ ...chore, base_reward: value })} />
          <NumberInput label="权重" value={chore.weight} onChange={(value) => onChange({ ...chore, weight: value })} />
          <label className="checkbox-line">
            <input type="checkbox" checked={chore.disabled} onChange={(event) => onChange({ ...chore, disabled: event.target.checked })} />
            禁用
          </label>
        </div>
      </div>
    </article>
  )
}

function AuctionLotEditor({
  lot,
  onChange,
  onSave,
  onCancel,
}: {
  lot: AuctionLot
  onChange: (lot: AuctionLot) => void
  onSave: () => void
  onCancel: () => void
}) {
  const closesLocal = toDateTimeLocalValue(lot.closes_at)
  return (
    <article className="panel">
      <div className="item-card__top">
        <div>
          <h2>{lot.game_items?.name ?? lot.item_id}</h2>
          <p>
            {lot.source} · {lot.status}
          </p>
        </div>
        <span className="badge">{lot.current_bid ?? 0} 灵石</span>
      </div>
      <div className="form-grid">
        <NumberInput label="起拍价" value={lot.start_price} onChange={(value) => onChange({ ...lot, start_price: value })} />
        <label>
          结算时间
          <input
            type="datetime-local"
            value={closesLocal}
            onChange={(event) => onChange({ ...lot, closes_at: fromDateTimeLocalValue(event.target.value, lot.closes_at) })}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="secondary-button" onClick={onSave}>
          <Save size={16} /> 保存
        </button>
        <button className="secondary-button" disabled={lot.status !== 'active'} onClick={onCancel}>
          取消并退款
        </button>
      </div>
    </article>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label>
      {label}
      <input value={String(value)} inputMode="decimal" onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function fromDateTimeLocalValue(value: string, fallback: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function parseConfigValue(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : value
  }
}
