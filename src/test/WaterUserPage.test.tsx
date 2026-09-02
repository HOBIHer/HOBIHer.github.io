import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaterUserPage } from '../pages/WaterUserPage'

describe('WaterUserPage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
  })

  beforeEach(() => {
    window.localStorage.clear()
    document.title = 'HOBIHer Hub'
    document.head.querySelectorAll('[data-test-favicon]').forEach((element) => element.remove())
    vi.stubEnv('VITE_WATER_USER_MOCK', 'true')
    vi.stubGlobal('Image', ReadyImage as unknown as typeof Image)
  })

  afterEach(() => {
    window.location.hash = ''
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the Pu water title and favicon only while this page is mounted', () => {
    const defaultFavicon = document.createElement('link')
    defaultFavicon.rel = 'icon'
    defaultFavicon.href = '/default-favicon.png'
    defaultFavicon.setAttribute('data-test-favicon', 'true')
    document.head.appendChild(defaultFavicon)

    const { unmount } = render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    const waterFavicon = document.head.querySelector('link[data-water-favicon="true"]')
    expect(document.title).toBe('Pu水啦')
    expect(waterFavicon).toHaveAttribute('href', expect.stringContaining('/assets/water/pu-water-tab-icon.png'))
    expect(defaultFavicon).toBeInTheDocument()

    unmount()

    expect(document.title).toBe('HOBIHer Hub')
    expect(document.head.querySelector('link[data-water-favicon="true"]')).not.toBeInTheDocument()
    expect(defaultFavicon).toBeInTheDocument()
    defaultFavicon.remove()
  })

  it('exposes the primary mobile actions with accessible labels', async () => {
    const { container } = render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '喝一杯，从瓶中取水 250 毫升' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '喝水页面导航' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刮刮乐' })).toBeInTheDocument()
    expect(container.querySelector('[data-animation-slot="drink-action"]')).toBeInTheDocument()
    expect(await screen.findByText('当前第 1 瓶剩余 1000ml；喝空后结算 1 张刮刮乐。')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText('当前水瓶剩余 1000 毫升，共 1000 毫升')).toHaveTextContent('100%')
    })
  })

  it('opens the tarot promotion at the tarot hash route', async () => {
    window.location.hash = '#/water'

    render(
      <HashRouter>
        <Routes>
          <Route path="/water" element={<WaterUserPage />} />
          <Route path="/tarot" element={<h1>塔罗测试路由</h1>} />
        </Routes>
      </HashRouter>,
    )

    const tarotLink = await screen.findByRole('link', { name: /塔罗/ })
    expect(tarotLink).toHaveAttribute('href', '#/tarot')

    fireEvent.click(tarotLink)

    expect(await screen.findByRole('heading', { name: '塔罗测试路由' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#/tarot'))
  })

  it('hides the tarot promotion when the shared water setting is disabled', async () => {
    window.localStorage.setItem('water-admin-mock-db-v2', JSON.stringify({
      coupons: [],
      rewards: [],
      settings: { tarotPromoEnabled: false, updatedAt: new Date().toISOString() },
    }))

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    await screen.findByText('当前第 1 瓶剩余 1000ml；喝空后结算 1 张刮刮乐。')
    expect(screen.queryByRole('link', { name: /塔罗占卜屋/ })).not.toBeInTheDocument()
  })

  it('shows an empty bottle and disables drinking after two bottles', async () => {
    window.localStorage.setItem('water-user-mock-state-v2', JSON.stringify({
      date: todayKey(),
      waterMl: 0,
      totalMl: 2000,
      completedBottles: 2,
      ownedCouponCodes: [],
    }))

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '今日记录已完成' })).toBeInTheDocument()
    expect(screen.getByText('今日 2 瓶均已喝空，不再接受新的喝水记录。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '今日两瓶已喝空，一口按钮已停用' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '今日两瓶已喝空，一杯按钮已停用' })).toBeDisabled()
    expect(screen.getByLabelText('今日两瓶已喝空，当前瓶剩余 0 毫升')).toHaveTextContent('0%')
  })

  it('lowers the visible bottle level as recorded drinking increases', async () => {
    window.localStorage.setItem('water-user-mock-state-v2', JSON.stringify({
      date: todayKey(),
      waterMl: 250,
      totalMl: 250,
      completedBottles: 0,
      ownedCouponCodes: [],
    }))

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('当前第 1 瓶剩余 750ml；喝空后结算 1 张刮刮乐。')).toBeInTheDocument()
    expect(screen.getByLabelText('当前水瓶剩余 750 毫升，共 1000 毫升')).toHaveTextContent('75%')
  })

  it('plays the Woodstock sprite sequence for a sip', async () => {
    const { container } = render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    await screen.findByText('当前第 1 瓶剩余 1000ml；喝空后结算 1 张刮刮乐。')
    const sipButton = screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })
    await waitFor(() => expect(sipButton).toBeEnabled())
    fireEvent.click(sipButton)

    expect(screen.getByText('糊涂塌客 · 一口 20ml')).toBeInTheDocument()
    expect(container.querySelector('.water-drink-sprite--sip')).toBeInTheDocument()
    await screen.findByText('当前第 1 瓶剩余 980ml；喝空后结算 1 张刮刮乐。', {}, { timeout: 2500 })
  })

  it('plays the Snoopy sprite sequence for a cup', async () => {
    const { container } = render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    await screen.findByText('当前第 1 瓶剩余 1000ml；喝空后结算 1 张刮刮乐。')
    const cupButton = screen.getByRole('button', { name: '喝一杯，从瓶中取水 250 毫升' })
    await waitFor(() => expect(cupButton).toBeEnabled())
    fireEvent.click(cupButton)

    expect(screen.getByText('史努比 · 一杯 250ml')).toBeInTheDocument()
    expect(container.querySelector('.water-drink-sprite--cup')).toBeInTheDocument()
    await screen.findByText('当前第 1 瓶剩余 750ml；喝空后结算 1 张刮刮乐。', {}, { timeout: 2500 })
  })

  it('summarizes the redeemed cash amount in the scratch-card area', async () => {
    const coupons = [
      mockCoupon('cash-10', 'cash_10', '10元现金红包', 'redeemed'),
      mockCoupon('cash-20', 'cash_20', '20元现金红包', 'redeemed'),
      mockCoupon('cash-520', 'cash_520', '520元现金红包', 'issued'),
      mockCoupon('mystery', 'super_mystery', '超级神秘大奖', 'redeemed'),
    ]
    window.localStorage.setItem('water-user-mock-state-v2', JSON.stringify({
      date: todayKey(),
      waterMl: 0,
      totalMl: 0,
      completedBottles: 0,
      ownedCouponCodes: coupons.map((coupon) => coupon.code),
    }))
    window.localStorage.setItem('water-admin-mock-db-v2', JSON.stringify({ coupons, rewards: [] }))

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /刮刮乐/ }))
    expect(await screen.findByText('已兑换金额')).toBeInTheDocument()
    expect(await screen.findByText('¥30')).toBeInTheDocument()
    expect(screen.getByText('已兑换 3 张')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '我的刮刮乐' })).toBeInTheDocument()
    expect(screen.queryByText('我的卡券')).not.toBeInTheDocument()
  })
})

function mockCoupon(
  id: string,
  rewardKey: string,
  rewardName: string,
  status: 'issued' | 'redeemed',
) {
  return {
    id,
    code: `H2O-${id}`,
    lookupKey: `LOOKUP-${id}`,
    rewardId: `reward-${id}`,
    rewardKey,
    rewardName,
    rewardDescription: `${rewardName}线下兑换。`,
    status,
    createdAt: '2026-07-28T00:00:00.000Z',
    requestedAt: status === 'redeemed' ? '2026-07-28T01:00:00.000Z' : null,
    redeemedAt: status === 'redeemed' ? '2026-07-28T02:00:00.000Z' : null,
    requestId: status === 'redeemed' ? `request-${id}` : null,
  }
}

function todayKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

class ReadyImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  complete = true
  naturalWidth = 1
  naturalHeight = 1
  private source = ''

  get src() { return this.source }
  set src(value: string) {
    this.source = value
    this.onload?.()
  }

  decode() { return Promise.resolve() }
}
