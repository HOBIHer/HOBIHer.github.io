import { Play, Save, Swords } from 'lucide-react'
import { useState } from 'react'
import { StatBar } from '../components/StatBar'
import { DEFAULT_METHOD } from '../game/constants'
import { simulateBattle, type BattleLogLine, type BattleResult, type Combatant } from '../game/battle'
import { computeLevelSeedConfig, computeStats, getEquippedMethod } from '../game/formulas'
import { useGame } from '../store/gameStore'

const npcNames = ['青衣斗者', '黑岩弟子', '炎门客卿', '风雷散修']

export function BattlePage() {
  const { profile, levels, items, settle, saveBattleResult, battleLogs } = useGame()
  const [result, setResult] = useState<BattleResult | null>(null)
  const [visibleLogs, setVisibleLogs] = useState<BattleLogLine[]>([])
  const [saving, setSaving] = useState(false)
  const [opponentName, setOpponentName] = useState('同境 NPC')

  if (!profile || levels.length === 0) return null
  const activeProfile = profile

  const level = levels.find((entry) => entry.level_order === activeProfile.level_order) ?? levels[0]
  const method = getEquippedMethod(items, activeProfile.equipped_method_id)
  const skills = items.filter((item) => item.item_type === 'skill' && item.owner_id === activeProfile.id)
  const stats = computeStats(level, method)
  const subOffset = (new Date().getSeconds() % 5) - 2
  const sub = Math.min(9, Math.max(1, level.sub_index + subOffset))
  const enemyLevel = computeLevelSeedConfig(level.realm_index, sub)
  const enemyStats = computeStats(enemyLevel, DEFAULT_METHOD)

  async function runBattle() {
    const settledProfile = (await settle()) ?? activeProfile
    const settledLevel = levels.find((entry) => entry.level_order === settledProfile.level_order) ?? level
    const settledMethod = getEquippedMethod(items, settledProfile.equipped_method_id)
    const settledSubOffset = (new Date().getSeconds() % 5) - 2
    const settledSub = Math.min(9, Math.max(1, settledLevel.sub_index + settledSubOffset))
    const settledEnemyLevel = computeLevelSeedConfig(settledLevel.realm_index, settledSub)
    const settledEnemyStats = computeStats(settledEnemyLevel, DEFAULT_METHOD)
    const enemyName = npcNames[new Date().getSeconds() % npcNames.length]
    setOpponentName(enemyName)
    const player: Combatant = {
      id: settledProfile.id,
      name: settledProfile.display_name ?? settledProfile.username,
      levelConfig: settledLevel,
      method: settledMethod,
      skills,
      strategy: settledProfile.battle_strategy,
      hp: settledProfile.current_hp,
      qi: settledProfile.current_qi,
    }
    const enemy: Combatant = {
      id: 'npc',
      name: enemyName,
      levelConfig: settledEnemyLevel,
      method: DEFAULT_METHOD,
      skills: skills.length ? skills.slice(0, 2) : [],
      strategy: skills.slice(0, 2).map((skill) => skill.id),
      hp: settledEnemyStats.maxHp,
      qi: settledEnemyStats.maxQi,
    }
    const next = simulateBattle({ player, enemy, seed: Date.now() % 1_000_000 })
    setResult(next)
    setVisibleLogs([])
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setVisibleLogs(next.logs.slice(0, index))
      if (index >= next.logs.length) window.clearInterval(timer)
    }, 1000)
  }

  async function save() {
    if (!result) return
    setSaving(true)
    try {
      await saveBattleResult({
        opponentName,
        result: result.winner === 'player' ? 'win' : result.winner === 'timeout' ? 'timeout' : 'lose',
        playerHpAfter: result.playerHpAfter,
        playerQiAfter: result.playerQiAfter,
        rewardPayload: result.rewardWorker ?? {},
        logs: result.logs,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page-stack">
      <section className="panel">
        <div className="item-card__top">
          <div>
            <h2>同境 NPC</h2>
            <p>{enemyLevel.label}</p>
          </div>
          <Swords />
        </div>
        <div className="duel-grid">
          <StatBar label="我方血量" value={activeProfile.current_hp} max={stats.maxHp} tone="hp" />
          <StatBar label="我方斗气" value={activeProfile.current_qi} max={stats.maxQi} tone="qi" />
          <StatBar label="敌方血量" value={enemyStats.maxHp} max={enemyStats.maxHp} tone="hp" />
          <StatBar label="敌方斗气" value={enemyStats.maxQi} max={enemyStats.maxQi} tone="qi" />
        </div>
        <div className="button-row">
          <button className="primary-button" disabled={activeProfile.current_hp <= 1} onClick={() => void runBattle()}>
            <Play size={18} /> 开战
          </button>
          <button className="secondary-button" disabled={!result || saving} onClick={() => void save()}>
            <Save size={18} /> 保存
          </button>
        </div>
      </section>

      {result ? (
        <section className="panel">
          <h2>{result.winner === 'player' ? '胜利' : '败退'}</h2>
          <dl className="mini-grid">
            <div>
              <dt>剩余血量</dt>
              <dd>{result.playerHpAfter}</dd>
            </div>
            <div>
              <dt>剩余斗气</dt>
              <dd>{result.playerQiAfter}</dd>
            </div>
            <div>
              <dt>耗时</dt>
              <dd>{result.elapsedSeconds}s</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="battle-log">
        {visibleLogs.map((log, index) => (
          <p key={`${log.second}-${index}`}>
            <span>{log.second}s</span> {log.text}
          </p>
        ))}
      </section>

      <section className="page-stack">
        <h2 className="section-title">战斗记录</h2>
        {battleLogs.map((log) => (
          <article className="panel" key={log.id}>
            <div className="item-card__top">
              <h2>{log.opponent_name}</h2>
              <span className="badge">{log.result}</span>
            </div>
            <p className="muted">{new Date(log.created_at).toLocaleString()}</p>
          </article>
        ))}
      </section>
    </section>
  )
}
