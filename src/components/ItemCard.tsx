import { Lock, Swords } from 'lucide-react'
import type { ReactNode } from 'react'
import { computePracticeProgress, formatNumber } from '../game/formulas'
import { elementLabel, tierGradeLabel } from '../game/labels'
import type { GameItem } from '../game/types'
import { ProgressBar } from './ProgressBar'

interface ItemCardProps {
  item: GameItem
  equipped?: boolean
  selected?: boolean
  action?: ReactNode
}

export function ItemCard({ item, equipped, selected, action }: ItemCardProps) {
  const progress = item.item_type === 'skill' ? computePracticeProgress(item) : null
  return (
    <article className={`item-card ${selected ? 'item-card--selected' : ''}`}>
      <div className="item-card__top">
        <div>
          <h3>{item.name}</h3>
          <p>
            {tierGradeLabel(item.tier, item.grade)} · {elementLabel(item.element)}
          </p>
        </div>
        <div className="item-card__badges">
          {equipped ? <span className="badge badge--gold">已装备</span> : null}
          {item.is_locked ? (
            <span className="badge">
              <Lock size={12} /> 锁定
            </span>
          ) : null}
        </div>
      </div>
      <p className="muted">{item.description}</p>
      {item.item_type === 'method' ? (
        <dl className="mini-grid">
          <div>
            <dt>修炼</dt>
            <dd>{formatNumber(item.speed_multiplier, 2)}x</dd>
          </div>
          <div>
            <dt>潜力</dt>
            <dd>{formatNumber(item.potential_multiplier, 2)}x</dd>
          </div>
          <div>
            <dt>攻防</dt>
            <dd>
              {formatNumber(item.attack_multiplier, 2)} / {formatNumber(item.defense_multiplier, 2)}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="skill-progress">
          <div className="stat-bar__row">
            <span>
              <Swords size={14} /> {progress?.stage}
            </span>
            <strong>{Math.round((progress?.pct ?? 0) * 100)}%</strong>
          </div>
          <ProgressBar value={progress?.pct ?? 0} tone="jade" />
        </div>
      )}
      {action ? <div className="item-card__action">{action}</div> : null}
    </article>
  )
}
