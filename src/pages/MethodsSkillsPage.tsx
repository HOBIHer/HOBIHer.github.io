import { Dumbbell, Eye, Swords } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ItemCard } from '../components/ItemCard'
import { Modal } from '../components/Modal'
import { DEFAULT_METHOD } from '../game/constants'
import { computeSkillDamagePreview, computeStats, getEquippedMethod } from '../game/formulas'
import { useGame } from '../store/gameStore'

export function MethodsSkillsPage() {
  const { profile, levels, items, globalConfig, equipMethod, startActivity, updateBattleStrategy } = useGame()
  const [tab, setTab] = useState<'methods' | 'skills'>('methods')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const methods = items.filter((item) => item.item_type === 'method' && item.owner_id === profile?.id)
  const skills = items.filter((item) => item.item_type === 'skill' && item.owner_id === profile?.id)
  const level = levels.find((entry) => entry.level_order === profile?.level_order) ?? levels[0]
  const method = getEquippedMethod(items, profile?.equipped_method_id ?? null)
  const stats = level ? computeStats(level, method) : computeStats({ level_order: 0, realm_index: 0, sub_index: 1, realm_key: 'dou_zhi_qi', realm_name: '斗之气', label: '斗之气一段', threshold: 300, base_rate_per_sec: 1, hp_base: 100, qi_base: 60, attack_base: 8, defense_base: 2 }, method)
  const defender = { maxHp: stats.maxHp, maxQi: stats.maxQi, attack: stats.attack, defense: Math.max(1, stats.defense) }
  const previewSkill = skills.find((skill) => skill.id === previewId)
  const previews = useMemo(
    () => skills.map((skill) => ({ skill, preview: computeSkillDamagePreview(stats, defender, skill, method ?? DEFAULT_METHOD) })),
    [defender, method, skills, stats],
  )

  if (!profile) return null
  const activeProfile = profile

  function toggleStrategy(skillId: string) {
    const existing = activeProfile.battle_strategy ?? []
    const next = existing.includes(skillId)
      ? existing.filter((id) => id !== skillId)
      : [...existing.filter((id) => id !== skillId), skillId].slice(0, 6)
    void updateBattleStrategy(next)
  }

  return (
    <section className="page-stack">
      <div className="segmented">
        <button className={tab === 'methods' ? 'active' : ''} onClick={() => setTab('methods')}>
          功法
        </button>
        <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>
          斗技
        </button>
      </div>

      {tab === 'methods' ? (
        <div className="list-stack">
          {methods.length === 0 ? <div className="notice">尚未拥有功法</div> : null}
          {methods.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              equipped={item.id === activeProfile.equipped_method_id}
              action={
                <button className="secondary-button" disabled={item.is_locked} onClick={() => void equipMethod(item.id)}>
                  <Dumbbell size={16} /> 装备
                </button>
              }
            />
          ))}
        </div>
      ) : (
        <div className="list-stack">
          {skills.map((skill) => {
            const selected = activeProfile.battle_strategy.includes(skill.id)
            return (
              <ItemCard
                key={skill.id}
                item={skill}
                selected={selected}
                action={
                  <div className="button-row">
                    <button className="secondary-button" disabled={skill.is_locked} onClick={() => void startActivity('practicing_skill', skill.id)}>
                      <Swords size={16} /> 熟练
                    </button>
                    {!skill.is_basic ? (
                      <button className="secondary-button" onClick={() => toggleStrategy(skill.id)}>
                        {selected ? '移除顺序' : '加入顺序'}
                      </button>
                    ) : null}
                    <button className="icon-button" onClick={() => setPreviewId(skill.id)} title="预览">
                      <Eye size={16} />
                    </button>
                  </div>
                }
              />
            )
          })}
          <section className="panel">
            <h2>释放顺序</h2>
            <ol className="strategy-list">
              {activeProfile.battle_strategy.map((id, index) => {
                const skill = skills.find((entry) => entry.id === id)
                return <li key={id}>{skill ? `${index + 1}. ${skill.name}` : `${index + 1}. 已失效斗技`}</li>
              })}
              {activeProfile.battle_strategy.length === 0 ? <li>普通攻击</li> : null}
            </ol>
          </section>
        </div>
      )}

      <Modal title="伤害预览" open={Boolean(previewSkill)} onClose={() => setPreviewId(null)}>
        {previews
          .filter(({ skill }) => skill.id === previewId)
          .map(({ skill, preview }) => (
            <div className="preview-box" key={skill.id}>
              <h3>{preview.skillName}</h3>
              <dl className="mini-grid">
                <div>
                  <dt>伤害</dt>
                  <dd>{preview.damage}</dd>
                </div>
                <div>
                  <dt>消耗</dt>
                  <dd>{preview.qiCost}</dd>
                </div>
                <div>
                  <dt>冷却</dt>
                  <dd>{preview.cooldown}s</dd>
                </div>
              </dl>
              <p className="muted">{preview.note}</p>
            </div>
          ))}
      </Modal>
      <div className="notice">熟练速度 {globalConfig.skill_practice_rate_per_sec}/秒</div>
    </section>
  )
}
