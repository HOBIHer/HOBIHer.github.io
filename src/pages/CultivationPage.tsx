import { useEffect, useState } from 'react'
import { HeartPulse, Pause, Play, Sparkles } from 'lucide-react'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import { StatBar } from '../components/StatBar'
import { getEquippedMethod, computeCultivationRate, computeStats, formatNumber } from '../game/formulas'
import { projectCultivation } from '../game/projection'
import { activityLabel, elementLabel } from '../game/labels'
import { useGame } from '../store/gameStore'

export function CultivationPage() {
  const { profile, levels, items, globalConfig, startActivity } = useGame()
  const [realmOpen, setRealmOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!profile || levels.length === 0) return null

  const method = getEquippedMethod(items, profile.equipped_method_id)
  const currentLevel = levels.find((level) => level.level_order === profile.level_order) ?? levels[0]
  const projection = projectCultivation(profile, levels, method, globalConfig, now)
  const projectedLevel = levels.find((level) => level.level_order === projection.levelOrder) ?? currentLevel
  const stats = computeStats(projectedLevel, method)
  const rate = computeCultivationRate(projectedLevel, method, globalConfig)
  const hpFull = profile.current_hp >= stats.maxHp && profile.current_qi >= stats.maxQi

  return (
    <section className="page-stack">
      <article className="hero-panel">
        <div className="cultivator-orb">
          <span>{projectedLevel.realm_name.slice(0, 1)}</span>
        </div>
        <div>
          <p className="eyebrow">{activityLabel(profile.activity_type)}</p>
          <h2>{projection.projectedLabel}</h2>
          <p>
            {method.name} · {elementLabel(method.element)}
          </p>
        </div>
      </article>

      <section className="panel">
        <div className="stat-bar__row">
          <span>斗气</span>
          <strong>
            {formatNumber(projection.xp, 1)} / {formatNumber(projection.threshold)}
          </strong>
        </div>
        <ProgressBar value={projection.progressPct} tone="gold" />
        <dl className="mini-grid">
          <div>
            <dt>速度</dt>
            <dd>{formatNumber(rate, 2)}/秒</dd>
          </div>
          <div>
            <dt>灵石</dt>
            <dd>{formatNumber(profile.coins)}</dd>
          </div>
          <div>
            <dt>层级</dt>
            <dd>{profile.level_order + 1}/108</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <StatBar label="血量" value={profile.current_hp} max={stats.maxHp} tone="hp" />
        <StatBar label="斗气" value={profile.current_qi} max={stats.maxQi} tone="qi" />
        <dl className="mini-grid">
          <div>
            <dt>攻击</dt>
            <dd>{stats.attack}</dd>
          </div>
          <div>
            <dt>防御</dt>
            <dd>{stats.defense}</dd>
          </div>
          <div>
            <dt>上限</dt>
            <dd>
              {stats.maxHp}/{stats.maxQi}
            </dd>
          </div>
        </dl>
      </section>

      <div className="action-grid">
        <button className="primary-button" onClick={() => void startActivity('cultivating')}>
          <Play size={18} /> 修炼
        </button>
        <button className="secondary-button" onClick={() => void startActivity('idle')}>
          <Pause size={18} /> 暂停
        </button>
        <button className="secondary-button" disabled={hpFull} onClick={() => void startActivity('healing')}>
          <HeartPulse size={18} /> 疗伤
        </button>
        <button className="secondary-button" onClick={() => setRealmOpen(true)}>
          <Sparkles size={18} /> 境界
        </button>
      </div>

      <Modal title="修炼体系" open={realmOpen} onClose={() => setRealmOpen(false)}>
        <div className="realm-list">
          {levels.map((level) => (
            <div key={level.level_order} className={level.level_order === profile.level_order ? 'active' : ''}>
              <span>{level.level_order + 1}</span>
              <strong>{level.label}</strong>
              <small>{formatNumber(level.threshold)} 斗气</small>
            </div>
          ))}
        </div>
      </Modal>
    </section>
  )
}
