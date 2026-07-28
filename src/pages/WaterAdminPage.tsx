import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Database,
  Droplets,
  Gift,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Ticket,
  TicketCheck,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  clearWaterAdminSession,
  getWaterApiMode,
  listWaterCoupons,
  listWaterRewards,
  loginWaterAdmin,
  markWaterCouponRedeemed,
  readWaterAdminSession,
  upsertWaterReward,
  WaterApiError,
  type WaterAdminSession,
  type WaterCoupon,
  type WaterCouponFilter,
  type WaterCouponStats,
  type WaterReward,
  type WaterRewardInput,
} from '../lib/waterApi'
import '../styles/water-admin.css'

type AdminView = 'coupons' | 'rewards'
type Feedback = { kind: 'success' | 'error'; text: string } | null

const PAGE_SIZE = 24
const EMPTY_STATS: WaterCouponStats = { total: 0, issued: 0, requested: 0, redeemed: 0, redeemedAmount: 0 }

const FILTERS: Array<{ value: WaterCouponFilter; label: string; stat?: keyof WaterCouponStats }> = [
  { value: 'all', label: '全部', stat: 'total' },
  { value: 'redemption_requested', label: '待线下兑换', stat: 'requested' },
  { value: 'issued', label: '未申请', stat: 'issued' },
  { value: 'redeemed', label: '已完成', stat: 'redeemed' },
]

export function WaterAdminPage() {
  const mode = getWaterApiMode()
  const [session, setSession] = useState<WaterAdminSession | null>(() => readWaterAdminSession())
  const [view, setView] = useState<AdminView>('coupons')
  const [filter, setFilter] = useState<WaterCouponFilter>('all')
  const [queryDraft, setQueryDraft] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [coupons, setCoupons] = useState<WaterCoupon[]>([])
  const [couponTotal, setCouponTotal] = useState(0)
  const [stats, setStats] = useState<WaterCouponStats>(EMPTY_STATS)
  const [rewards, setRewards] = useState<WaterReward[]>([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [loadingRewards, setLoadingRewards] = useState(false)
  const [processingCoupon, setProcessingCoupon] = useState<string | null>(null)
  const [savingReward, setSavingReward] = useState<string | null>(null)
  const [showNewReward, setShowNewReward] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const couponRequestSeq = useRef(0)
  const rewardRequestSeq = useRef(0)

  const expireSessionIfNeeded = useCallback((error: unknown) => {
    if (error instanceof WaterApiError && (error.status === 401 || error.status === 403)) {
      clearWaterAdminSession()
      setSession(null)
    }
  }, [])

  const loadCoupons = useCallback(async (preserveFeedback = false) => {
    if (!session) return
    const requestSeq = ++couponRequestSeq.current
    setLoadingCoupons(true)
    if (!preserveFeedback) setFeedback(null)
    try {
      const result = await listWaterCoupons(session, {
        status: filter,
        query,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      if (requestSeq !== couponRequestSeq.current) return
      setCouponTotal(result.total)
      setStats(result.stats)
      setLastUpdatedAt(new Date().toISOString())
      const lastAvailablePage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1)
      if (page > lastAvailablePage) {
        setPage(lastAvailablePage)
        return
      }
      setCoupons(result.coupons)
    } catch (error) {
      if (requestSeq !== couponRequestSeq.current) return
      expireSessionIfNeeded(error)
      setFeedback({ kind: 'error', text: errorMessage(error, '刮刮乐数据加载失败') })
    } finally {
      if (requestSeq === couponRequestSeq.current) setLoadingCoupons(false)
    }
  }, [expireSessionIfNeeded, filter, page, query, session])

  const loadRewards = useCallback(async (preserveFeedback = false) => {
    if (!session) return
    const requestSeq = ++rewardRequestSeq.current
    setLoadingRewards(true)
    if (!preserveFeedback) setFeedback(null)
    try {
      const nextRewards = await listWaterRewards(session)
      if (requestSeq !== rewardRequestSeq.current) return
      setRewards(nextRewards)
      setLastUpdatedAt(new Date().toISOString())
    } catch (error) {
      if (requestSeq !== rewardRequestSeq.current) return
      expireSessionIfNeeded(error)
      setFeedback({ kind: 'error', text: errorMessage(error, '奖池数据加载失败') })
    } finally {
      if (requestSeq === rewardRequestSeq.current) setLoadingRewards(false)
    }
  }, [expireSessionIfNeeded, session])

  useEffect(() => {
    if (session && view === 'coupons') void loadCoupons()
  }, [loadCoupons, session, view])

  useEffect(() => {
    if (session && view === 'rewards') void loadRewards()
  }, [loadRewards, session, view])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const username = String(form.get('username') || '').trim()
    const password = String(form.get('password') || '')
    setFeedback(null)

    try {
      const nextSession = await loginWaterAdmin(username, password)
      setSession(nextSession)
      setView('coupons')
      setPage(0)
      formElement.reset()
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error, '登录失败') })
    }
  }

  function handleLogout() {
    couponRequestSeq.current += 1
    rewardRequestSeq.current += 1
    clearWaterAdminSession()
    setSession(null)
    setCoupons([])
    setRewards([])
    setFeedback(null)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(0)
    setQuery(queryDraft.trim())
  }

  function clearSearch() {
    setQueryDraft('')
    setQuery('')
    setPage(0)
  }

  async function completeRedemption(coupon: WaterCoupon) {
    const confirmed = window.confirm(`确认“${coupon.rewardName}”已经在线下兑换完成？\n\n刮刮乐编号：${coupon.code}`)
    if (!confirmed || !session) return

    setProcessingCoupon(coupon.id)
    setFeedback(null)
    try {
      await markWaterCouponRedeemed(session, coupon)
      setFeedback({ kind: 'success', text: `${coupon.code} 已标记为兑换完成` })
      await loadCoupons(true)
    } catch (error) {
      expireSessionIfNeeded(error)
      setFeedback({ kind: 'error', text: errorMessage(error, '标记兑换失败') })
    } finally {
      setProcessingCoupon(null)
    }
  }

  async function saveReward(input: WaterRewardInput) {
    if (!session || savingReward !== null) return false
    const savingKey = input.id || 'new'
    setSavingReward(savingKey)
    setFeedback(null)
    try {
      const saved = await upsertWaterReward(session, input)
      setFeedback({ kind: 'success', text: `奖励“${saved.name}”已保存` })
      setShowNewReward(false)
      await loadRewards(true)
      return true
    } catch (error) {
      expireSessionIfNeeded(error)
      setFeedback({ kind: 'error', text: errorMessage(error, '奖励保存失败') })
      return false
    } finally {
      setSavingReward(null)
    }
  }

  if (!session) {
    return <WaterAdminLogin mode={mode} feedback={feedback} onSubmit={handleLogin} />
  }

  const pageCount = Math.max(1, Math.ceil(couponTotal / PAGE_SIZE))

  return (
    <main className="water-admin-page">
      <div className="water-admin-orb water-admin-orb--one" aria-hidden="true" />
      <div className="water-admin-orb water-admin-orb--two" aria-hidden="true" />

      <div className="water-admin-shell">
        <header className="water-admin-header">
          <Link className="water-admin-brand" to="/" aria-label="返回 HOBIHer 首页">
            <span className="water-admin-brand__mark" aria-hidden="true">
              <Droplets size={23} strokeWidth={2.3} />
            </span>
            <span>
              <strong>H₂O Rewards</strong>
              <small>喝水奖励管理台</small>
            </span>
          </Link>

          <div className="water-admin-header__actions">
            <span className={`water-admin-mode water-admin-mode--${mode}`}>
              <Database size={14} aria-hidden="true" />
              {mode === 'mock' ? '自验数据' : mode === 'remote' ? '云端数据' : '待配置'}
            </span>
            <button
              className="water-admin-icon-button"
              type="button"
              onClick={() => void (view === 'coupons' ? loadCoupons() : loadRewards())}
              disabled={loadingCoupons || loadingRewards}
              aria-label="刷新当前数据"
              title="刷新"
            >
              <RefreshCw className={loadingCoupons || loadingRewards ? 'is-spinning' : ''} size={18} />
            </button>
            <button className="water-admin-quiet-button" type="button" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" />
              <span>退出</span>
            </button>
          </div>
        </header>

        {mode === 'mock' ? (
          <aside className="water-admin-demo-notice" aria-label="自验模式说明">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              当前为本地自验模式。操作会保存在此浏览器中，不会改动线上刮刮乐；配置独立的 `VITE_WATER_*`
              环境变量即可切换云端。
            </span>
          </aside>
        ) : null}

        {mode === 'misconfigured' ? (
          <aside className="water-admin-feedback water-admin-feedback--error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            缺少喝水服务的公开环境变量，请配置后重新构建。
          </aside>
        ) : null}

        <section className="water-admin-intro" aria-labelledby="water-admin-title">
          <div>
            <span className="water-admin-eyebrow">Redemption desk</span>
            <h1 id="water-admin-title">每一口水，都有回响。</h1>
            <p>核对唯一券码、跟进兑换申请，并在完成线下履约后留下明确记录。</p>
          </div>
          <div className="water-admin-intro__meta">
            <span>当前账号</span>
            <strong>admin</strong>
            <small>会话至 {formatDate(session.expiresAt, true)}</small>
          </div>
        </section>

        <nav className="water-admin-tabs" aria-label="后台功能">
          <button
            className={view === 'coupons' ? 'is-active' : ''}
            type="button"
            aria-current={view === 'coupons' ? 'page' : undefined}
            onClick={() => setView('coupons')}
          >
            <TicketCheck size={17} aria-hidden="true" />
            刮刮乐与兑换
          </button>
          <button
            className={view === 'rewards' ? 'is-active' : ''}
            type="button"
            aria-current={view === 'rewards' ? 'page' : undefined}
            onClick={() => setView('rewards')}
          >
            <Gift size={17} aria-hidden="true" />
            奖池设置
          </button>
        </nav>

        {feedback ? (
          <div
            className={`water-admin-feedback water-admin-feedback--${feedback.kind}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {feedback.kind === 'success' ? <CircleCheck size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.text}</span>
            <button type="button" onClick={() => setFeedback(null)} aria-label="关闭提示">
              <X size={16} />
            </button>
          </div>
        ) : null}

        {view === 'coupons' ? (
          <CouponDashboard
            coupons={coupons}
            couponTotal={couponTotal}
            stats={stats}
            filter={filter}
            query={query}
            queryDraft={queryDraft}
            page={page}
            pageCount={pageCount}
            loading={loadingCoupons}
            processingCoupon={processingCoupon}
            lastUpdatedAt={lastUpdatedAt}
            onFilter={(next) => {
              setFilter(next)
              setPage(0)
            }}
            onQueryDraft={setQueryDraft}
            onSearch={handleSearch}
            onClearSearch={clearSearch}
            onPage={setPage}
            onComplete={(coupon) => void completeRedemption(coupon)}
            onFeedback={setFeedback}
          />
        ) : (
          <RewardPool
            rewards={rewards}
            loading={loadingRewards}
            showNew={showNewReward}
            savingReward={savingReward}
            onShowNew={setShowNewReward}
            onSave={saveReward}
          />
        )}

        <footer className="water-admin-footer">
          <span>HOBIHer · Water Rewards Demo</span>
          <span>{lastUpdatedAt ? `最近刷新 ${formatDate(lastUpdatedAt, true)}` : '等待首次同步'}</span>
        </footer>
      </div>
    </main>
  )
}

function WaterAdminLogin({
  mode,
  feedback,
  onSubmit,
}: {
  mode: ReturnType<typeof getWaterApiMode>
  feedback: Feedback
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    setSubmitting(true)
    try {
      await onSubmit(event)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="water-admin-page water-admin-page--login">
      <div className="water-admin-orb water-admin-orb--one" aria-hidden="true" />
      <div className="water-admin-orb water-admin-orb--two" aria-hidden="true" />
      <section className="water-admin-login-card" aria-labelledby="water-admin-login-title">
        <Link className="water-admin-brand water-admin-brand--login" to="/" aria-label="返回 HOBIHer 首页">
          <span className="water-admin-brand__mark" aria-hidden="true">
            <Droplets size={25} strokeWidth={2.3} />
          </span>
          <span>
            <strong>H₂O Rewards</strong>
            <small>喝水奖励管理台</small>
          </span>
        </Link>

        <div className="water-admin-login-copy">
          <span className="water-admin-eyebrow">Private console</span>
          <h1 id="water-admin-login-title">欢迎回来</h1>
          <p>登录后查看刮刮乐状态，处理她发起的兑换申请。</p>
        </div>

        {feedback ? (
          <div className="water-admin-feedback water-admin-feedback--error" role="alert">
            <AlertCircle size={18} />
            <span>{feedback.text}</span>
          </div>
        ) : null}

        {mode === 'misconfigured' ? (
          <div className="water-admin-feedback water-admin-feedback--error" role="alert">
            <AlertCircle size={18} />
            <span>服务未配置。添加 `VITE_WATER_*` 变量，或设置 `VITE_WATER_ADMIN_MOCK=true` 进行自验。</span>
          </div>
        ) : null}

        <form className="water-admin-login-form" onSubmit={submit}>
          <label>
            <span>用户名</span>
            <span className="water-admin-input-wrap">
              <ShieldCheck size={17} aria-hidden="true" />
              <input
                name="username"
                type="text"
                autoComplete="username"
                placeholder="请输入后台用户名"
                required
                autoFocus
              />
            </span>
          </label>
          <label>
            <span>密码</span>
            <span className="water-admin-input-wrap">
              <KeyRound size={17} aria-hidden="true" />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入后台密码"
                required
              />
            </span>
          </label>
          <button className="water-admin-primary-button" type="submit" disabled={submitting || mode === 'misconfigured'}>
            <LogIn size={17} aria-hidden="true" />
            {submitting ? '正在验证…' : '进入管理台'}
          </button>
        </form>

        <p className="water-admin-security-note">
          <ShieldCheck size={15} aria-hidden="true" />
          {mode === 'mock' ? '自验账号：admin / admin' : '密码仅发送至 Edge Function 校验，不会写入浏览器存储。'}
        </p>
      </section>
    </main>
  )
}

interface CouponDashboardProps {
  coupons: WaterCoupon[]
  couponTotal: number
  stats: WaterCouponStats
  filter: WaterCouponFilter
  query: string
  queryDraft: string
  page: number
  pageCount: number
  loading: boolean
  processingCoupon: string | null
  lastUpdatedAt: string | null
  onFilter: (filter: WaterCouponFilter) => void
  onQueryDraft: (query: string) => void
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onClearSearch: () => void
  onPage: (page: number) => void
  onComplete: (coupon: WaterCoupon) => void
  onFeedback: (feedback: Feedback) => void
}

function CouponDashboard({
  coupons,
  couponTotal,
  stats,
  filter,
  query,
  queryDraft,
  page,
  pageCount,
  loading,
  processingCoupon,
  lastUpdatedAt,
  onFilter,
  onQueryDraft,
  onSearch,
  onClearSearch,
  onPage,
  onComplete,
  onFeedback,
}: CouponDashboardProps) {
  return (
    <div className="water-admin-content">
      <section className="water-admin-stats" aria-label="刮刮乐统计">
        <StatCard icon={<Ticket size={19} />} label="全部刮刮乐" value={stats.total} tone="blue" />
        <StatCard icon={<Clock3 size={19} />} label="待线下兑换" value={stats.requested} tone="amber" emphasized />
        <StatCard icon={<Droplets size={19} />} label="未申请兑换" value={stats.issued} tone="mint" />
        <StatCard icon={<CircleCheck size={19} />} label="已兑换完成" value={stats.redeemed} tone="violet" />
        <StatCard icon={<Gift size={19} />} label="已兑换金额" value={stats.redeemedAmount} suffix="元" tone="mint" />
      </section>

      <section className="water-admin-panel" aria-labelledby="coupon-list-title">
        <div className="water-admin-panel__heading">
          <div>
            <span className="water-admin-eyebrow">Scratch-card ledger</span>
            <h2 id="coupon-list-title">刮刮乐台账</h2>
          </div>
          <span className="water-admin-sync-time">
            {lastUpdatedAt ? `更新于 ${formatDate(lastUpdatedAt, true)}` : '正在同步'}
          </span>
        </div>

        <div className="water-admin-toolbar">
          <div className="water-admin-filter-group" role="group" aria-label="按兑换状态筛选">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                className={filter === item.value ? 'is-active' : ''}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => onFilter(item.value)}
              >
                {item.label}
                {item.stat ? <span>{stats[item.stat]}</span> : null}
              </button>
            ))}
          </div>

          <form className="water-admin-search" role="search" onSubmit={onSearch}>
            <label className="water-admin-sr-only" htmlFor="water-coupon-search">
              查询券码或后台 Key
            </label>
            <Search size={17} aria-hidden="true" />
            <input
              id="water-coupon-search"
              value={queryDraft}
              onChange={(event) => onQueryDraft(event.target.value)}
              placeholder="输入券码 / 查询 Key / 奖励名"
              autoComplete="off"
            />
            {queryDraft ? (
              <button className="water-admin-search__clear" type="button" onClick={onClearSearch} aria-label="清空查询">
                <X size={15} />
              </button>
            ) : null}
            <button className="water-admin-search__submit" type="submit">
              查询
            </button>
          </form>
        </div>

        {query ? (
          <div className="water-admin-query-summary" role="status">
            正在查询 <code>{query}</code>，共找到 {couponTotal} 条
            <button type="button" onClick={onClearSearch}>查看全部</button>
          </div>
        ) : null}

        {loading ? (
          <CouponSkeleton />
        ) : coupons.length ? (
          <div className="water-admin-coupon-list">
            {coupons.map((coupon) => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                processing={processingCoupon === coupon.id}
                onComplete={() => onComplete(coupon)}
                onFeedback={onFeedback}
              />
            ))}
          </div>
        ) : (
          <div className="water-admin-empty">
            <Ticket size={28} aria-hidden="true" />
            <h3>没有符合条件的刮刮乐</h3>
            <p>{query ? '试试完整券码、查询 Key，或清除搜索条件。' : '当前筛选状态下还没有记录。'}</p>
          </div>
        )}

        {pageCount > 1 ? (
          <nav className="water-admin-pagination" aria-label="刮刮乐列表分页">
            <button type="button" disabled={page === 0 || loading} onClick={() => onPage(page - 1)}>
              <ChevronLeft size={16} /> 上一页
            </button>
            <span>
              第 {page + 1} / {pageCount} 页
            </span>
            <button type="button" disabled={page + 1 >= pageCount || loading} onClick={() => onPage(page + 1)}>
              下一页 <ChevronRight size={16} />
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  suffix = '',
  tone,
  emphasized = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix?: string
  tone: 'blue' | 'amber' | 'mint' | 'violet'
  emphasized?: boolean
}) {
  return (
    <article className={`water-admin-stat water-admin-stat--${tone}${emphasized ? ' is-emphasized' : ''}`}>
      <span className="water-admin-stat__icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <strong>{value.toLocaleString('zh-CN')}{suffix}</strong>
    </article>
  )
}

function CouponCard({
  coupon,
  processing,
  onComplete,
  onFeedback,
}: {
  coupon: WaterCoupon
  processing: boolean
  onComplete: () => void
  onFeedback: (feedback: Feedback) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const status = couponStatusPresentation(coupon.status)

  async function copy(value: string, label: string) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      window.setTimeout(() => setCopied((current) => (current === value ? null : current)), 1600)
    } catch {
      onFeedback({ kind: 'error', text: `${label}复制失败，请手动选择复制` })
    }
  }

  return (
    <article className={`water-admin-coupon water-admin-coupon--${coupon.status}`}>
      <div className="water-admin-coupon__status-rail" aria-hidden="true" />
      <div className="water-admin-coupon__main">
        <div className="water-admin-coupon__reward">
          <span className="water-admin-reward-icon" aria-hidden="true"><Gift size={19} /></span>
          <div>
            <span className="water-admin-coupon__label">奖励内容</span>
            <h3>{coupon.rewardName}</h3>
            {coupon.rewardDescription ? <p>{coupon.rewardDescription}</p> : null}
            {coupon.rewardCode ? <code className="water-admin-reward-code">{coupon.rewardCode}</code> : null}
          </div>
        </div>

        <dl className="water-admin-coupon__codes">
          <div>
            <dt>唯一券码</dt>
            <dd>
              <code>{coupon.code || '—'}</code>
              {coupon.code ? (
                <button type="button" onClick={() => void copy(coupon.code, '券码')} aria-label="复制唯一券码">
                  {copied === coupon.code ? <Check size={15} /> : <Copy size={15} />}
                </button>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>后台查询 Key</dt>
            <dd>
              <code>{coupon.lookupKey || '—'}</code>
              {coupon.lookupKey ? (
                <button type="button" onClick={() => void copy(coupon.lookupKey, '查询 Key')} aria-label="复制后台查询 Key">
                  {copied === coupon.lookupKey ? <Check size={15} /> : <Copy size={15} />}
                </button>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>

      <div className="water-admin-coupon__side">
        <span className={`water-admin-status water-admin-status--${coupon.status}`}>
          {status.icon}
          {status.label}
        </span>
        <dl className="water-admin-coupon__timeline">
          <div><dt>抽中时间</dt><dd>{formatDate(coupon.createdAt)}</dd></div>
          {coupon.requestedAt ? <div><dt>申请时间</dt><dd>{formatDate(coupon.requestedAt)}</dd></div> : null}
          {coupon.redeemedAt ? <div><dt>完成时间</dt><dd>{formatDate(coupon.redeemedAt)}</dd></div> : null}
        </dl>
        {coupon.status === 'redemption_requested' ? (
          <button className="water-admin-complete-button" type="button" disabled={processing} onClick={onComplete}>
            <TicketCheck size={16} aria-hidden="true" />
            {processing ? '正在确认…' : '标记线下兑换完成'}
          </button>
        ) : coupon.status === 'issued' ? (
          <span className="water-admin-coupon__hint">等待用户端申请兑换</span>
        ) : (
          <span className="water-admin-coupon__hint water-admin-coupon__hint--done">
            <Check size={14} aria-hidden="true" /> 已留存兑换记录
          </span>
        )}
      </div>
    </article>
  )
}

function CouponSkeleton() {
  return (
    <div className="water-admin-coupon-list" aria-label="正在加载刮刮乐" aria-busy="true">
      {[0, 1, 2].map((item) => (
        <div className="water-admin-skeleton" key={item} aria-hidden="true">
          <span /><span /><span />
        </div>
      ))}
    </div>
  )
}

function RewardPool({
  rewards,
  loading,
  showNew,
  savingReward,
  onShowNew,
  onSave,
}: {
  rewards: WaterReward[]
  loading: boolean
  showNew: boolean
  savingReward: string | null
  onShowNew: (show: boolean) => void
  onSave: (reward: WaterRewardInput) => Promise<boolean>
}) {
  const enabledWeight = useMemo(
    () => rewards.reduce((total, reward) => total + (reward.enabled ? Math.max(0, reward.weight) : 0), 0),
    [rewards],
  )

  return (
    <section className="water-admin-panel water-admin-rewards" aria-labelledby="reward-pool-title">
      <div className="water-admin-panel__heading water-admin-panel__heading--actions">
        <div>
          <span className="water-admin-eyebrow">Prize pool</span>
          <h2 id="reward-pool-title">刮刮乐奖池</h2>
          <p>权重是相对值；实际概率 = 单项权重 ÷ 全部启用项权重。</p>
        </div>
        <button
          className="water-admin-primary-button water-admin-primary-button--compact"
          type="button"
          disabled={savingReward !== null}
          onClick={() => onShowNew(true)}
        >
          <Plus size={16} /> 新增奖励
        </button>
      </div>

      <aside className="water-admin-pool-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>修改只影响之后生成的刮刮乐；已经抽中的刮刮乐继续保留当时的奖励快照。</span>
      </aside>

      {showNew ? (
        <RewardEditor
          reward={{
            id: '',
            code: '',
            name: '',
            description: '',
            weight: 10,
            enabled: true,
            sortOrder: (rewards.length + 1) * 10,
            createdAt: null,
            updatedAt: null,
          }}
          probability={null}
          saving={savingReward !== null}
          isNew
          onCancel={() => onShowNew(false)}
          onSave={onSave}
        />
      ) : null}

      {loading && rewards.length === 0 ? (
        <div className="water-admin-reward-grid" aria-busy="true" aria-label="正在加载奖池">
          {[0, 1, 2].map((item) => <div className="water-admin-skeleton water-admin-skeleton--reward" key={item} />)}
        </div>
      ) : rewards.length ? (
        <div className="water-admin-reward-grid">
          {rewards.map((reward) => (
            <RewardEditor
              key={reward.id}
              reward={reward}
              probability={reward.enabled && enabledWeight > 0 ? (reward.weight / enabledWeight) * 100 : 0}
              saving={savingReward !== null}
              onSave={onSave}
            />
          ))}
        </div>
      ) : (
        <div className="water-admin-empty">
          <Gift size={28} aria-hidden="true" />
          <h3>奖池还是空的</h3>
          <p>新增至少一个启用且权重大于 0 的奖励，才能正常开奖。</p>
        </div>
      )}
    </section>
  )
}

function RewardEditor({
  reward,
  probability,
  saving,
  isNew = false,
  onCancel,
  onSave,
}: {
  reward: WaterReward
  probability: number | null
  saving: boolean
  isNew?: boolean
  onCancel?: () => void
  onSave: (reward: WaterRewardInput) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<WaterRewardInput>(() => rewardToInput(reward))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(rewardToInput(reward))
  }, [dirty, reward])

  function updateDraft(patch: Partial<WaterRewardInput>) {
    setDirty(true)
    setDraft((current) => ({ ...current, ...patch }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await onSave(draft)) setDirty(false)
  }

  return (
    <form className={`water-admin-reward-editor${isNew ? ' water-admin-reward-editor--new' : ''}`} onSubmit={submit}>
      <div className="water-admin-reward-editor__top">
        <span className="water-admin-reward-icon" aria-hidden="true"><Gift size={18} /></span>
        <div>
          <span>{isNew ? 'New reward' : draft.enabled ? 'In draw pool' : 'Paused'}</span>
          <strong>{isNew ? '新增奖励' : draft.name || '未命名奖励'}</strong>
        </div>
        {!isNew ? (
          <span className="water-admin-probability" title="基于当前启用项权重估算">
            {probability?.toFixed(probability < 1 ? 2 : 1)}%
          </span>
        ) : null}
      </div>

      <div className="water-admin-reward-fields">
        <label>
          <span>奖励编号</span>
          <input
            value={draft.code}
            onChange={(event) => updateDraft({ code: event.target.value.toUpperCase().replace(/\s+/g, '_') })}
            placeholder="例如 MILK_TEA"
            maxLength={64}
            pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,63}"
            title="只能使用字母、数字、下划线或短横线"
            required
          />
        </label>
        <label>
          <span>奖励名称</span>
          <input
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="例如 50元现金红包"
            maxLength={120}
            required
          />
        </label>
        <label className="water-admin-reward-fields__wide">
          <span>兑现说明</span>
          <textarea
            value={draft.description}
            onChange={(event) => updateDraft({ description: event.target.value })}
            placeholder="会展示在刮刮乐上的补充说明"
            maxLength={1000}
            rows={2}
          />
        </label>
        <label>
          <span>抽中权重</span>
          <input
            type="number"
            min="1"
            step="1"
            value={draft.weight}
            onChange={(event) => updateDraft({ weight: Number(event.target.value) })}
            required
          />
        </label>
        <label>
          <span>展示顺序</span>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.sortOrder}
            onChange={(event) => updateDraft({ sortOrder: Number(event.target.value) })}
            required
          />
        </label>
        <label className="water-admin-toggle-field">
          <span>参与抽奖</span>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => updateDraft({ enabled: event.target.checked })}
          />
          <span className="water-admin-toggle" aria-hidden="true"><span /></span>
          <strong>{draft.enabled ? '启用' : '暂停'}</strong>
        </label>
      </div>

      <div className="water-admin-reward-editor__actions">
        {isNew && onCancel ? (
          <button className="water-admin-quiet-button" type="button" onClick={onCancel}>
            取消
          </button>
        ) : null}
        <button className="water-admin-save-button" type="submit" disabled={saving}>
          <Save size={16} /> {saving ? '保存中…' : '保存设置'}
        </button>
      </div>
    </form>
  )
}

function rewardToInput(reward: WaterReward): WaterRewardInput {
  return {
    id: reward.id || undefined,
    code: reward.code,
    name: reward.name,
    description: reward.description,
    weight: reward.weight,
    enabled: reward.enabled,
    sortOrder: reward.sortOrder,
  }
}

function couponStatusPresentation(status: WaterCoupon['status']) {
  if (status === 'redemption_requested') {
    return { label: '待线下兑换', icon: <Clock3 size={14} aria-hidden="true" /> }
  }
  if (status === 'redeemed') {
    return { label: '已兑换完成', icon: <CircleCheck size={14} aria-hidden="true" /> }
  }
  return { label: '未申请兑换', icon: <Ticket size={14} aria-hidden="true" /> }
}

function formatDate(value: string | null, compact = false): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(compact ? {} : { year: 'numeric' as const }),
    hour12: false,
  }).format(date)
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
