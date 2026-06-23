import { Banknote, Clock, Hammer, RefreshCw } from 'lucide-react'
import { computeWorkerIncome, formatNumber } from '../game/formulas'
import { qualityLabel } from '../game/labels'
import { useGame } from '../store/gameStore'

export function ChoresPage() {
  const { chores, workers, generateDailyChores, startActivity, collectWorkerIncome, globalConfig } = useGame()

  return (
    <section className="page-stack">
      <div className="button-row">
        <button className="primary-button" onClick={() => void generateDailyChores()}>
          <RefreshCw size={18} /> 今日杂工
        </button>
      </div>

      <section className="list-stack">
        {chores.length === 0 ? <div className="notice">今日暂无任务</div> : null}
        {chores.map((roll) => {
          const template = roll.chore_templates
          return (
            <article className="panel" key={roll.id}>
              <div className="item-card__top">
                <div>
                  <h2>{template?.name ?? '杂工任务'}</h2>
                  <p>
                    {template ? qualityLabel(template.quality) : '任务'} · {template?.duration_minutes ?? 0} 分钟
                  </p>
                </div>
                <span className="badge">{roll.status}</span>
              </div>
              <p className="muted">{template?.description}</p>
              <dl className="mini-grid">
                <div>
                  <dt>成功</dt>
                  <dd>{Math.round((template?.success_rate ?? 0) * 100)}%</dd>
                </div>
                <div>
                  <dt>奖励</dt>
                  <dd>{roll.reward || template?.base_reward || 0}</dd>
                </div>
                <div>
                  <dt>开始</dt>
                  <dd>{roll.started_at ? new Date(roll.started_at).toLocaleTimeString() : '-'}</dd>
                </div>
              </dl>
              <button
                className="secondary-button"
                disabled={roll.status !== 'available'}
                onClick={() => void startActivity('doing_chore', roll.id)}
              >
                <Hammer size={16} /> 开始
              </button>
            </article>
          )
        })}
      </section>

      <section className="page-stack">
        <h2 className="section-title">手下败将</h2>
        {workers.length === 0 ? <div className="notice">尚无工人</div> : null}
        {workers.map((worker) => {
          const income = computeWorkerIncome(worker, new Date(), globalConfig.worker_income_cap_hours)
          return (
            <article className="panel" key={worker.id}>
              <div className="item-card__top">
                <div>
                  <h2>{worker.name}</h2>
                  <p>{worker.realm_label}</p>
                </div>
                <span className="badge">效率 {formatNumber(worker.efficiency, 2)}</span>
              </div>
              <dl className="mini-grid">
                <div>
                  <dt>可收</dt>
                  <dd>{income}</dd>
                </div>
                <div>
                  <dt>上次</dt>
                  <dd>{new Date(worker.last_collected_at).toLocaleTimeString()}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{worker.active ? '打工' : '休息'}</dd>
                </div>
              </dl>
              <button className="secondary-button" onClick={() => void collectWorkerIncome(worker.id)}>
                <Banknote size={16} /> 收取工钱
              </button>
            </article>
          )
        })}
      </section>

      <div className="notice">
        <Clock size={14} /> 工钱最多累计 {globalConfig.worker_income_cap_hours} 小时
      </div>
    </section>
  )
}
