import { Anchor, Crown, Droplets, Flame, LockKeyhole, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

const placeholders = ['星海档案', '炼金工坊', '云端秘境']

export function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-label="游戏入口">
        <div className="landing-hero__copy">
          <span className="landing-kicker">HOBIHer Hub</span>
          <h1>Man</h1>
          <p>What can I say?</p>
        </div>

        <nav className="portal-grid" aria-label="项目跳转">
          <a className="portal-card portal-card--fish" href="./backups/backup-20260623-151737/">
            <span className="portal-card__icon" aria-hidden="true">
              <Anchor size={24} />
            </span>
            <span>
              <strong>杀戮摸鱼2</strong>
              <small>Slayfish 备份入口</small>
            </span>
          </a>

          <Link className="portal-card portal-card--doupo" to="/doupo">
            <span className="portal-card__icon" aria-hidden="true">
              <Flame size={24} />
            </span>
            <span>
              <strong>斗破苍穹</strong>
              <small>斗气挂机修炼</small>
            </span>
          </Link>

          <Link className="portal-card portal-card--worldcup" to="/guess-saint">
            <span className="portal-card__icon" aria-hidden="true">
              <Trophy size={24} />
            </span>
            <span>
              <strong>世界杯土块</strong>
              <small>波董土块封神榜</small>
            </span>
          </Link>

          <Link className="portal-card portal-card--hall" to="/beauty-hall">
            <span className="portal-card__icon" aria-hidden="true">
              <Crown size={24} />
            </span>
            <span>
              <strong>MasterPiece</strong>
              <small>Path behind the scenes</small>
            </span>
          </Link>

          <Link className="portal-card portal-card--water" to="/water">
            <span className="portal-card__icon" aria-hidden="true">
              <Droplets size={24} />
            </span>
            <span>
              <strong>喝水记录</strong>
              <small>从水瓶取水，喝空结算刮刮乐</small>
            </span>
          </Link>

          <Link className="portal-card portal-card--water-admin" to="/water-admin">
            <span className="portal-card__icon" aria-hidden="true">
              <ShieldCheck size={24} />
            </span>
            <span>
              <strong>喝水刮刮乐后台</strong>
              <small>查询、核销与奖池管理</small>
            </span>
          </Link>

          {placeholders.map((label, index) => (
            <button className="portal-card portal-card--locked" key={label} type="button" disabled>
              <span className="portal-card__icon" aria-hidden="true">
                {index === 0 ? <Sparkles size={24} /> : <LockKeyhole size={24} />}
              </span>
              <span>
                <strong>{label}</strong>
                <small>即将开放</small>
              </span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  )
}
