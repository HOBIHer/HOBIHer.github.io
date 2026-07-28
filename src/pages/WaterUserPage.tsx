import {
  CheckCircle2,
  Cloud,
  Copy,
  Droplets,
  FlaskConical,
  Gift,
  Home,
  RefreshCw,
  Ticket,
} from 'lucide-react'
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  addWater,
  getPendingScratchCoupon,
  getWaterCouponScratchedAt,
  getWaterUserMode,
  getWaterUserState,
  listWaterUserCoupons,
  markWaterCouponScratched,
  requestWaterCouponRedeem,
  setPendingScratchCoupon,
  type WaterUserCoupon,
  type WaterUserState,
} from '../lib/waterUserApi'
import '../styles/water-user.css'

const BOTTLE_CAPACITY_ML = 1000
const SCRATCH_REVEAL_THRESHOLD = 0.42
const DRINK_ANIMATION_FRAME_COUNT = 8
const DRINK_ANIMATION_FRAME_DURATION_MS = 180
const DRINK_ANIMATION_DURATION_MS = DRINK_ANIMATION_FRAME_COUNT * DRINK_ANIMATION_FRAME_DURATION_MS

type WaterTab = 'water' | 'coupons'

const EMPTY_STATE: WaterUserState = {
  waterMl: 0,
  bottleRemainingMl: BOTTLE_CAPACITY_ML,
  totalMl: 0,
  completedBottles: 0,
  date: '',
  bottleCapacityMl: BOTTLE_CAPACITY_ML,
  dailyBottleLimit: 2,
  dailyLimitReached: false,
  remainingDailyMl: 2000,
  redeemedAmount: 0,
}

export function WaterUserPage() {
  const [tab, setTab] = useState<WaterTab>('water')
  const [waterState, setWaterState] = useState<WaterUserState>(EMPTY_STATE)
  const [coupons, setCoupons] = useState<WaterUserCoupon[]>([])
  const [scratchCoupon, setScratchCoupon] = useState<WaterUserCoupon | null>(() => {
    const pending = getPendingScratchCoupon()
    return pending && !getWaterCouponScratchedAt(pending.code) ? pending : null
  })
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<number | null>(null)
  const [drinkAnimation, setDrinkAnimation] = useState<{ amountMl: 20 | 250; runId: number } | null>(null)
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestSequence = useRef(0)
  const mutationCount = useRef(0)
  const mounted = useRef(true)
  const noticeTimer = useRef<number | null>(null)
  const drinkAnimationTimer = useRef<number | null>(null)
  const mode = getWaterUserMode()

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600)
  }, [])

  const refreshAll = useCallback(async (showSpinner = true) => {
    if (mutationCount.current > 0) return
    const sequence = ++requestSequence.current
    if (showSpinner) setLoading(true)
    setError('')

    try {
      const [nextState, nextCoupons] = await Promise.all([
        getWaterUserState(),
        listWaterUserCoupons(),
      ])
      if (!mounted.current || sequence !== requestSequence.current) return
      setWaterState(nextState)
      setCoupons(nextCoupons)

      const pending = getPendingScratchCoupon()
      if (pending && getWaterCouponScratchedAt(pending.code)) setPendingScratchCoupon(null)
      else if (pending) setScratchCoupon((current) => current ?? pending)
    } catch (loadError) {
      if (!mounted.current || sequence !== requestSequence.current) return
      setError(messageOf(loadError, '进度加载失败，请稍后重试。'))
    } finally {
      if (mounted.current && sequence === requestSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const previousTitle = document.title
    document.title = '喝水记录 · HOBIHer'
    for (const source of [
      '/assets/water/woodstock-sip-sprite.png',
      '/assets/water/snoopy-cup-sprite.png',
    ]) {
      const image = new Image()
      image.src = source
    }
    void refreshAll()

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshAll(false)
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      mounted.current = false
      requestSequence.current += 1
      document.title = previousTitle
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
      if (drinkAnimationTimer.current !== null) window.clearTimeout(drinkAnimationTimer.current)
    }
  }, [refreshAll])

  const capacity = waterState.bottleCapacityMl || BOTTLE_CAPACITY_ML
  const dailyBottleLimit = waterState.dailyBottleLimit || 2
  const dailyLimitReached = waterState.dailyLimitReached ||
    waterState.completedBottles >= dailyBottleLimit || waterState.remainingDailyMl <= 0
  const consumedInBottleMl = dailyLimitReached
    ? capacity
    : Math.max(0, Math.min(capacity, waterState.waterMl || 0))
  const bottleRemainingMl = dailyLimitReached
    ? 0
    : Math.max(0, Math.min(
      capacity,
      Number.isFinite(waterState.bottleRemainingMl)
        ? waterState.bottleRemainingMl
        : capacity - consumedInBottleMl,
    ))
  const consumedPercent = Math.round((consumedInBottleMl / capacity) * 100)
  const bottleRemainingPercent = Math.round((bottleRemainingMl / capacity) * 100)
  const currentBottleNumber = Math.min(
    dailyBottleLimit,
    Math.max(1, (waterState.completedBottles || 0) + 1),
  )
  const pendingCount = coupons.filter((coupon) => coupon.status === 'redemption_requested').length
  const redeemedCount = coupons.filter((coupon) => coupon.status === 'redeemed').length
  const redeemedAmount = getRedeemedAmount(waterState, coupons)

  async function handleAddWater(amountMl: 20 | 250) {
    if (adding !== null || drinkAnimation !== null || loading || mode === 'misconfigured' || dailyLimitReached) return
    requestSequence.current += 1
    mutationCount.current += 1
    setAdding(amountMl)
    setDrinkAnimation({ amountMl, runId: Date.now() })
    if (drinkAnimationTimer.current !== null) window.clearTimeout(drinkAnimationTimer.current)
    drinkAnimationTimer.current = window.setTimeout(() => {
      if (mounted.current) setDrinkAnimation(null)
      drinkAnimationTimer.current = null
    }, DRINK_ANIMATION_DURATION_MS)
    setError('')

    try {
      const result = await settleAfterDelay(addWater(amountMl), DRINK_ANIMATION_DURATION_MS)
      if (!mounted.current) return
      setWaterState(result.state)
      const newCoupon = result.newCoupons[0]
      if (newCoupon) {
        setCoupons((current) => [newCoupon, ...current.filter((item) => item.code !== newCoupon.code)])
        setPendingScratchCoupon(newCoupon)
        setScratchCoupon(newCoupon)
        showNotice(result.state.dailyLimitReached
          ? '今日第 2 瓶已喝空，刮刮乐已生成。'
          : '已喝空一瓶，刮刮乐已生成。')
      } else {
        const applied = result.appliedAmountMl
        if (result.state.dailyLimitReached) {
          showNotice('今日已达到两瓶记录上限。')
        } else if (result.recoveredAmountMl && result.recoveredAmountMl !== applied) {
          showNotice(`已恢复上次 ${result.recoveredAmountMl}ml，并记录本次 ${applied}ml`)
        } else {
          showNotice(result.recovered ? `已恢复上次 ${applied}ml 喝水记录` : `已记录喝水 ${applied}ml`)
        }
      }
    } catch (addError) {
      if (mounted.current) setError(drinkingErrorMessage(addError))
    } finally {
      mutationCount.current = Math.max(0, mutationCount.current - 1)
      if (mounted.current) setAdding(null)
    }
  }

  async function handleRedeem(coupon: WaterUserCoupon) {
    if (redeemingCode || coupon.status !== 'issued') return
    requestSequence.current += 1
    mutationCount.current += 1
    setRedeemingCode(coupon.code)
    setError('')
    try {
      const updated = await requestWaterCouponRedeem(coupon)
      if (!mounted.current) return
      setCoupons((current) => current.map((item) => item.code === updated.code ? updated : item))
      showNotice('兑换申请已提交。')
    } catch (redeemError) {
      if (mounted.current) setError(messageOf(redeemError, '兑换申请提交失败，请稍后再试。'))
    } finally {
      mutationCount.current = Math.max(0, mutationCount.current - 1)
      if (mounted.current) setRedeemingCode(null)
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else if (!fallbackCopy(value)) throw new Error('clipboard unavailable')
      showNotice(`${label}已复制`)
    } catch {
      showNotice(`未能自动复制，请长按${label}`)
    }
  }

  function handleScratchRevealed(coupon: WaterUserCoupon) {
    setPendingScratchCoupon(null)
    setScratchCoupon(coupon)
    setCoupons((current) => current.map((item) => item.code === coupon.code ? coupon : item))
  }

  function openCouponsFromScratch() {
    setScratchCoupon(null)
    setTab('coupons')
    void refreshAll(false)
  }

  return (
    <main className="water-user-page">
      <div className="water-user-shell">
        <header className="water-user-header">
          <Link className="water-user-brand" to="/" aria-label="返回 HOBIHer 首页">
            <span className="water-user-brand__mark" aria-hidden="true"><Droplets size={20} /></span>
            <span>
              <strong>喝水记录</strong>
              <small>每日最多记录 2 瓶</small>
            </span>
          </Link>
          <div className={`water-user-mode water-user-mode--${mode}`}>
            {mode === 'mock' ? <FlaskConical size={14} /> : <Cloud size={14} />}
            <span>{mode === 'mock' ? '本地自验' : mode === 'remote' ? '云端同步' : '待配置'}</span>
          </div>
        </header>

        {error ? (
          <div className="water-user-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void refreshAll()}>重试</button>
          </div>
        ) : null}

        {tab === 'water' ? (
          <section className="water-user-home" aria-label="今日喝水进度">
            <div className="water-user-intro">
              <p>{dailyLimitReached ? 'DAILY LIMIT REACHED' : `BOTTLE ${currentBottleNumber} OF ${dailyBottleLimit}`}</p>
              <h1>{dailyLimitReached ? '今日记录已完成' : '今日喝水记录'}</h1>
              <span>{dailyLimitReached
                ? '今日 2 瓶均已喝空，不再接受新的喝水记录。'
                : `当前第 ${currentBottleNumber} 瓶剩余 ${bottleRemainingMl}ml；喝空后结算 1 张刮刮乐。`}</span>
            </div>

            {getPendingScratchCoupon() && !scratchCoupon ? (
              <button className="water-user-pending" type="button" onClick={() => setScratchCoupon(getPendingScratchCoupon())}>
                <Gift size={20} />
                <span><strong>有 1 张刮刮乐待揭晓</strong><small>点击继续刮开</small></span>
              </button>
            ) : null}

            <div className={`water-bottle-stage${drinkAnimation ? ' is-animating' : ''}`}>
              <div
                className={`water-drink-animation-overlay${drinkAnimation ? ' is-active' : ''}`}
                data-animation-slot="drink-action"
                aria-hidden="true"
              >
                {drinkAnimation ? (
                  <DrinkSpriteAnimation
                    key={drinkAnimation.runId}
                    amountMl={drinkAnimation.amountMl}
                  />
                ) : null}
              </div>
              <button
                className="water-add-button water-add-button--sip"
                type="button"
                disabled={loading || adding !== null || drinkAnimation !== null || mode === 'misconfigured' || dailyLimitReached}
                onClick={() => void handleAddWater(20)}
                aria-label={dailyLimitReached ? '今日两瓶已喝空，一口按钮已停用' : '喝一口，从瓶中取水 20 毫升'}
              >
                <span className="water-add-button__amount">−20</span>
                <strong>{dailyLimitReached ? '已停用' : adding === 20 ? '记录中' : '喝一口'}</strong>
                <small>{dailyLimitReached ? '今日上限' : '糊涂塌客 · 20ml'}</small>
              </button>

              <div
                className={`water-bottle ${bottleRemainingPercent <= 25 ? 'water-bottle--nearly-empty' : ''} ${dailyLimitReached ? 'water-bottle--empty' : ''}`}
                aria-label={dailyLimitReached
                  ? '今日两瓶已喝空，当前瓶剩余 0 毫升'
                  : `当前水瓶剩余 ${bottleRemainingMl} 毫升，共 ${capacity} 毫升`}
              >
                <div className="water-bottle__neck" />
                <div className="water-bottle__body">
                  <div className="water-bottle__shine" />
                  <div className="water-bottle__water" style={{ height: `${bottleRemainingPercent}%` }}>
                    <span className="water-bottle__wave" />
                    <span className="water-bottle__bubble water-bottle__bubble--one" />
                    <span className="water-bottle__bubble water-bottle__bubble--two" />
                  </div>
                  <div className="water-bottle__label">
                    <strong>{loading ? '…' : `${bottleRemainingPercent}%`}</strong>
                    <span>剩余 {bottleRemainingMl} / {capacity} ml</span>
                  </div>
                </div>
              </div>

              <button
                className="water-add-button water-add-button--cup"
                type="button"
                disabled={loading || adding !== null || drinkAnimation !== null || mode === 'misconfigured' || dailyLimitReached}
                onClick={() => void handleAddWater(250)}
                aria-label={dailyLimitReached ? '今日两瓶已喝空，一杯按钮已停用' : '喝一杯，从瓶中取水 250 毫升'}
              >
                <span className="water-add-button__amount">−250</span>
                <strong>{dailyLimitReached ? '已停用' : adding === 250 ? '记录中' : '喝一杯'}</strong>
                <small>{dailyLimitReached ? '今日上限' : '史努比 · 250ml'}</small>
              </button>
            </div>

            <div className="water-user-progress" aria-hidden="true">
              <span style={{ width: `${consumedPercent}%` }} />
            </div>

            <div className="water-user-stats">
              <div><span>今日已喝</span><strong>{waterState.totalMl || 0}<small> ml</small></strong></div>
              <div><span>已喝空</span><strong>{Math.min(waterState.completedBottles || 0, dailyBottleLimit)}<small> 瓶</small></strong></div>
              <div><span>待兑换</span><strong>{pendingCount}<small> 张</small></strong></div>
            </div>

            <aside className="water-user-note">
              <Droplets size={18} />
              <p><strong>记录规则</strong><span>每喝空一瓶结算 1 张刮刮乐，每日最多结算 2 张。</span></p>
            </aside>
          </section>
        ) : (
          <section className="water-coupons" aria-label="我的刮刮乐">
            <div className="water-coupons__heading">
              <div><p>SCRATCH CARDS</p><h1>我的刮刮乐</h1><span>查看奖励内容与兑换状态。</span></div>
              <button type="button" onClick={() => void refreshAll(false)} aria-label="刷新刮刮乐" disabled={loading}>
                <RefreshCw size={19} className={loading ? 'is-spinning' : ''} />
              </button>
            </div>

            <div className="water-coupons__summary" aria-label="刮刮乐兑换统计">
              <span>已兑换金额</span>
              <strong>¥{formatCurrencyAmount(redeemedAmount)}</strong>
              <small>已兑换 {redeemedCount} 张</small>
            </div>

            {coupons.length === 0 && !loading ? (
              <div className="water-coupons__empty">
                <Gift size={34} />
                <strong>暂无刮刮乐</strong>
                <span>喝空一瓶后会生成 1 张刮刮乐。</span>
                <button type="button" onClick={() => setTab('water')}>去喝水</button>
              </div>
            ) : (
              <div className="water-coupon-list">
                {coupons.map((coupon) => (
                  <article className={`water-coupon water-coupon--${coupon.status}`} key={coupon.id || coupon.code}>
                    <div className="water-coupon__top">
                      <span className="water-coupon__gift" aria-hidden="true"><Gift size={22} /></span>
                      <span className="water-coupon__status">{statusLabel(coupon.status)}</span>
                    </div>
                    <h2>{coupon.rewardName}</h2>
                    <p>{coupon.rewardDescription || '该刮刮乐用于线下兑换对应奖励。'}</p>
                    <div className="water-coupon__codes">
                      <button type="button" onClick={() => void copyValue(coupon.code, '刮刮乐编码')}>
                        <span>刮刮乐编码</span><strong>{coupon.code}</strong><Copy size={15} />
                      </button>
                      {coupon.lookupKey ? (
                        <button type="button" onClick={() => void copyValue(coupon.lookupKey, '查询 key')}>
                          <span>查询 key</span><strong>{coupon.lookupKey}</strong><Copy size={15} />
                        </button>
                      ) : null}
                    </div>
                    <div className="water-coupon__footer">
                      <small>{formatDate(coupon.createdAt)} 生成</small>
                      {coupon.status === 'issued' ? (
                        <button type="button" onClick={() => void handleRedeem(coupon)} disabled={Boolean(redeemingCode)}>
                          {redeemingCode === coupon.code ? '申请中…' : '申请兑换'}
                        </button>
                      ) : coupon.status === 'redemption_requested' ? (
                        <span><Ticket size={15} /> 等待线下兑换</span>
                      ) : (
                        <span><CheckCircle2 size={15} /> 已经兑换完成</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <nav className="water-user-tabs" aria-label="喝水页面导航">
          <button type="button" aria-current={tab === 'water' ? 'page' : undefined} onClick={() => setTab('water')}>
            <Home size={21} /><span>喝水</span>
          </button>
          <button type="button" aria-current={tab === 'coupons' ? 'page' : undefined} onClick={() => { setTab('coupons'); void refreshAll(false) }}>
            <span className="water-user-tabs__icon"><Ticket size={21} />{coupons.length ? <i>{coupons.length}</i> : null}</span>
            <span>刮刮乐</span>
          </button>
        </nav>

        {notice ? <div className="water-user-toast" role="status">{notice}</div> : null}
      </div>

      {scratchCoupon ? (
        <ScratchCardModal
          coupon={scratchCoupon}
          onClose={() => setScratchCoupon(null)}
          onRevealed={handleScratchRevealed}
          onViewCoupons={openCouponsFromScratch}
        />
      ) : null}
    </main>
  )
}

interface ScratchCardModalProps {
  coupon: WaterUserCoupon
  onClose: () => void
  onRevealed: (coupon: WaterUserCoupon) => void
  onViewCoupons: () => void
}

function DrinkSpriteAnimation({ amountMl }: { amountMl: 20 | 250 }) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    let nextFrame = 0
    const timer = window.setInterval(() => {
      nextFrame += 1
      setFrame(Math.min(nextFrame, DRINK_ANIMATION_FRAME_COUNT - 1))
      if (nextFrame >= DRINK_ANIMATION_FRAME_COUNT - 1) window.clearInterval(timer)
    }, DRINK_ANIMATION_FRAME_DURATION_MS)
    return () => window.clearInterval(timer)
  }, [])

  const column = frame % 4
  const row = Math.floor(frame / 4)
  const backgroundPosition = `${(column / 3) * 100}% ${row * 100}%`
  const character = amountMl === 20 ? '糊涂塌客' : '史努比'

  return (
    <div className="water-drink-animation">
      <div
        className={`water-drink-sprite water-drink-sprite--${amountMl === 20 ? 'sip' : 'cup'}`}
        data-frame={frame}
        style={{ backgroundPosition }}
      />
      <span>{character} · {amountMl === 20 ? '一口 20ml' : '一杯 250ml'}</span>
    </div>
  )
}

function ScratchCardModal({ coupon, onClose, onRevealed, onViewCoupons }: ScratchCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointer = useRef<number | null>(null)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const scratchedCells = useRef(new Set<string>())
  const canvasSize = useRef({ width: 0, height: 0 })
  const revealedRef = useRef(Boolean(getWaterCouponScratchedAt(coupon.code)))
  const [revealed, setRevealed] = useState(revealedRef.current)
  const [scratchPercent, setScratchPercent] = useState(revealed ? 100 : 0)

  const reveal = useCallback(() => {
    if (revealedRef.current) return
    revealedRef.current = true
    const scratchedAt = markWaterCouponScratched(coupon.code)
    const nextCoupon = { ...coupon, scratchedAt }
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (context) context.clearRect(0, 0, canvasSize.current.width, canvasSize.current.height)
    setScratchPercent(100)
    setRevealed(true)
    onRevealed(nextCoupon)
  }, [coupon, onRevealed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || revealedRef.current) return
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(260, rect.width)
    const height = Math.max(170, rect.height)
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvasSize.current = { width, height }

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#e8edf2')
    gradient.addColorStop(0.48, '#aeb9c5')
    gradient.addColorStop(1, '#d8e0e8')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    context.globalAlpha = 0.2
    for (let index = 0; index < 90; index += 1) {
      context.beginPath()
      context.arc((index * 67) % width, (index * 43) % height, 1 + (index % 3), 0, Math.PI * 2)
      context.fillStyle = index % 2 ? '#ffffff' : '#657384'
      context.fill()
    }
    context.globalAlpha = 1
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#ffffff'
    context.font = '700 18px system-ui, sans-serif'
    context.fillText('用手指来回刮开', width / 2, height / 2 - 12)
    context.fillStyle = 'rgba(255,255,255,.78)'
    context.font = '600 11px system-ui, sans-serif'
    context.fillText('SCRATCH TO REVEAL', width / 2, height / 2 + 18)
  }, [coupon.code])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    }
  }

  function erase(from: { x: number; y: number }, to: { x: number; y: number }) {
    if (revealedRef.current) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const radius = 25
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = radius * 2
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    context.beginPath()
    context.arc(to.x, to.y, radius, 0, Math.PI * 2)
    context.fill()
    context.restore()

    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(distance / 8))
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps
      markScratchCells(
        scratchedCells.current,
        from.x + (to.x - from.x) * ratio,
        from.y + (to.y - from.y) * ratio,
        canvasSize.current.width,
        canvasSize.current.height,
        radius,
      )
    }

    const percent = Math.min(100, Math.round((scratchedCells.current.size / (22 * 12)) * 100))
    setScratchPercent(percent)
    if (percent / 100 >= SCRATCH_REVEAL_THRESHOLD) reveal()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (revealedRef.current) return
    activePointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    lastPoint.current = point
    erase(point, point)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activePointer.current !== event.pointerId || revealedRef.current) return
    const point = pointFromEvent(event)
    erase(lastPoint.current || point, point)
    lastPoint.current = point
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activePointer.current === event.pointerId) activePointer.current = null
    lastPoint.current = null
  }

  return (
    <div className="scratch-modal" role="dialog" aria-modal="true" aria-labelledby="scratch-title">
      <button className="scratch-modal__backdrop" type="button" aria-label="稍后再刮" onClick={onClose} />
      <section className="scratch-modal__sheet">
        <div className="scratch-modal__handle" aria-hidden="true" />
        <p className="scratch-modal__eyebrow">BOTTLE SETTLEMENT</p>
        <h2 id="scratch-title">已喝空一瓶，结算 1 张刮刮乐</h2>
        <p className="scratch-modal__lead">反复滑动银色涂层；刮开约 42% 后显示奖励内容。</p>

        <div className={`scratch-card ${revealed ? 'scratch-card--revealed' : ''}`}>
          <div className="scratch-card__prize">
            <span aria-hidden="true"><Gift size={28} /></span>
            <small>奖励内容</small>
            <strong>{coupon.rewardName}</strong>
            <p>{coupon.rewardDescription || '该刮刮乐用于线下兑换对应奖励。'}</p>
            <code>{coupon.code}</code>
          </div>
          {!revealed ? (
            <canvas
              ref={canvasRef}
              className="scratch-card__canvas"
              aria-label="刮刮乐涂层，可用手指或鼠标反复刮动"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            />
          ) : null}
        </div>

        <div className="scratch-modal__progress">
          <span><i style={{ width: `${scratchPercent}%` }} /></span>
          <strong>{revealed ? '已经揭晓' : `已刮开 ${scratchPercent}%`}</strong>
        </div>

        <div className="scratch-modal__actions">
          {revealed ? (
            <>
              <button type="button" className="scratch-action scratch-action--primary" onClick={onViewCoupons}>查看我的刮刮乐</button>
              <button type="button" className="scratch-action scratch-action--quiet" onClick={onClose}>继续喝水</button>
            </>
          ) : (
            <>
              <button type="button" className="scratch-action scratch-action--primary" onClick={reveal}>直接揭晓</button>
              <button type="button" className="scratch-action scratch-action--quiet" onClick={onClose}>稍后再刮</button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function markScratchCells(
  cells: Set<string>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const columns = 22
  const rows = 12
  const cellWidth = width / columns
  const cellHeight = height / rows
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centerX = (column + 0.5) * cellWidth
      const centerY = (row + 0.5) * cellHeight
      if (Math.hypot(centerX - x, centerY - y) <= radius) cells.add(`${column}:${row}`)
    }
  }
}

function statusLabel(status: WaterUserCoupon['status']) {
  if (status === 'redemption_requested') return '待线下兑换'
  if (status === 'redeemed') return '已兑换'
  return '可申请'
}

function formatDate(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(value))
}

function getRedeemedAmount(state: WaterUserState, coupons: WaterUserCoupon[]) {
  const compatibleState = state as WaterUserState & {
    redeemedAmount?: number | string
    redeemed_amount?: number | string
  }
  const stateValue = Number(compatibleState.redeemedAmount ?? compatibleState.redeemed_amount)
  if (Number.isFinite(stateValue) && stateValue >= 0 &&
      (compatibleState.redeemedAmount !== undefined || compatibleState.redeemed_amount !== undefined)) {
    return stateValue
  }

  return coupons.reduce((total, coupon) => {
    if (coupon.status !== 'redeemed') return total
    const rewardKeyMatch = coupon.rewardKey?.trim().toLowerCase().match(/^cash_(\d+(?:\.\d+)?)$/)
    const rewardNameMatch = coupon.rewardName.match(/(\d+(?:\.\d+)?)\s*元(?:现金|红包)?/)
    const amount = Number(rewardKeyMatch?.[1] ?? rewardNameMatch?.[1])
    return Number.isFinite(amount) && amount > 0 ? total + amount : total
  }, 0)
}

function formatCurrencyAmount(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

async function settleAfterDelay<T>(operation: Promise<T>, delayMs: number): Promise<T> {
  const [result] = await Promise.allSettled([
    operation,
    new Promise<void>((resolve) => window.setTimeout(resolve, delayMs)),
  ])
  if (result.status === 'rejected') throw result.reason
  return result.value
}

function drinkingErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : ''
  if (code === 'WATER_DAILY_BOTTLE_LIMIT_REACHED') return '今日已达到两瓶记录上限。'
  return messageOf(error, '本次喝水记录失败，请检查网络后重试。')
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function fallbackCopy(value: string) {
  const field = document.createElement('textarea')
  field.value = value
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  return copied
}
