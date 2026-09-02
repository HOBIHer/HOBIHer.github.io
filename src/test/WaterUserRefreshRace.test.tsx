import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  addWater: vi.fn(),
  getState: vi.fn(),
  listCoupons: vi.fn(),
}))

vi.mock('../lib/waterUserApi', () => ({
  addWater: api.addWater,
  getPendingScratchCoupon: vi.fn(() => null),
  getWaterCouponScratchedAt: vi.fn(() => ''),
  getWaterUserMode: vi.fn(() => 'mock'),
  getWaterUserState: api.getState,
  listWaterUserCoupons: api.listCoupons,
  markWaterCouponScratched: vi.fn(() => new Date().toISOString()),
  requestWaterCouponRedeem: vi.fn(),
  setPendingScratchCoupon: vi.fn(),
}))

import { WaterUserPage } from '../pages/WaterUserPage'

const PROMO_LINK_NAME = '进入塔罗占卜屋：占卜屋开业啦，来逛逛吧'

describe('WaterUserPage refresh sequencing', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps the water interface visible when a quiet refresh supersedes initial loading', async () => {
    installControlledImage()
    let resolveInitialState!: (value: unknown) => void
    let resolveInitialCoupons!: (value: unknown[]) => void
    const initialState = new Promise((resolve) => { resolveInitialState = resolve })
    const initialCoupons = new Promise<unknown[]>((resolve) => { resolveInitialCoupons = resolve })
    const readyState = {
      waterMl: 0,
      totalMl: 0,
      completedBottles: 0,
      date: '2026-07-28',
      bottleCapacityMl: 1000,
      tarotPromoEnabled: true,
    }

    api.getState.mockImplementationOnce(() => initialState).mockResolvedValue(readyState)
    api.listCoupons.mockImplementationOnce(() => initialCoupons).mockResolvedValue([])

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })).toBeDisabled()
    expect(promoRegion().queryByRole('status')).not.toBeInTheDocument()

    fireEvent.focus(window)
    await waitFor(() => expect(api.getState).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('公告加载中…')).toBeInTheDocument()
    expect(promoRegion().getByRole('status')).toHaveTextContent('公告加载中…')
    expect(screen.getByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })).toBeEnabled()

    act(() => promoPreload().reject())
    await waitFor(() => expect(promoRegion().queryByRole('status')).not.toBeInTheDocument())

    await act(async () => {
      resolveInitialState(readyState)
      resolveInitialCoupons([])
      await Promise.all([initialState, initialCoupons])
    })

    expect(screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })).toBeEnabled()
  })

  it('plays eight 180ms frames before showing settlement and releasing the buttons', async () => {
    vi.useFakeTimers()
    installControlledImage()
    api.getState.mockResolvedValue(readyState())
    api.listCoupons.mockResolvedValue([])
    api.addWater.mockResolvedValue({
      state: { ...readyState(), waterMl: 20, bottleRemainingMl: 980, totalMl: 20, remainingDailyMl: 1980 },
      newCoupons: [],
      appliedAmountMl: 20,
      recovered: false,
    })

    const { container } = render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )
    await act(async () => { await Promise.resolve() })
    act(() => promoPreload().reject())

    const sipButton = screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })
    expect(sipButton).toBeEnabled()
    fireEvent.click(sipButton)

    const sprite = container.querySelector('.water-drink-sprite--sip')
    expect(sprite).toHaveAttribute('data-frame', '0')
    expect(sipButton).toBeDisabled()
    expect(screen.queryByText('已记录喝水 20ml')).not.toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(179) })
    expect(sprite).toHaveAttribute('data-frame', '0')
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(sprite).toHaveAttribute('data-frame', '1')

    await act(async () => { await vi.advanceTimersByTimeAsync(1259) })
    expect(screen.queryByText('已记录喝水 20ml')).not.toBeInTheDocument()
    expect(sipButton).toBeDisabled()

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText('已记录喝水 20ml')).toBeInTheDocument()
    expect(sipButton).toBeEnabled()
    expect(container.querySelector('.water-drink-sprite--sip')).not.toBeInTheDocument()
  })

  it('holds an add-water error until the complete 1.44s animation has ended', async () => {
    vi.useFakeTimers()
    installControlledImage()
    api.getState.mockResolvedValue(readyState())
    api.listCoupons.mockResolvedValue([])
    api.addWater.mockRejectedValue(new Error('测试喝水记录失败'))

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )
    await act(async () => { await Promise.resolve() })
    act(() => promoPreload().reject())

    const cupButton = screen.getByRole('button', { name: '喝一杯，从瓶中取水 250 毫升' })
    fireEvent.click(cupButton)
    await act(async () => { await vi.advanceTimersByTimeAsync(1439) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(cupButton).toBeDisabled()

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByRole('alert')).toHaveTextContent('测试喝水记录失败')
    expect(cupButton).toBeEnabled()
  })

  it('hides only the tarot announcement placeholder when the promo image fails', async () => {
    installControlledImage()
    api.getState.mockResolvedValue(readyState())
    api.listCoupons.mockResolvedValue([])

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(await screen.findByText('公告加载中…')).toBeInTheDocument()
    expect(promoRegion().getByRole('status')).toHaveTextContent('公告加载中…')
    expect(screen.queryByRole('link', { name: PROMO_LINK_NAME })).not.toBeInTheDocument()

    act(() => promoPreload().reject())

    await waitFor(() => expect(promoRegion().queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: PROMO_LINK_NAME })).not.toBeInTheDocument()
  })

  it('does not wait for the tarot promo image when the shared setting is false', async () => {
    installControlledImage()
    api.getState.mockResolvedValue({ ...readyState(), tarotPromoEnabled: false })
    api.listCoupons.mockResolvedValue([])

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })).toBeEnabled()
    })
    expect(promoRegion().queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: PROMO_LINK_NAME })).not.toBeInTheDocument()
    expect(promoPreload().complete).toBe(false)
  })

  it('shows the water screen immediately, swaps the placeholder for the promo, and reuses readiness on return', async () => {
    installControlledImage()
    api.getState.mockResolvedValue(readyState())
    api.listCoupons.mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/water']}>
        <Routes>
          <Route path="/water" element={<WaterUserPage />} />
          <Route
            path="/tarot"
            element={
              <main>
                <h1>塔罗测试路由</h1>
                <Link to="/water">返回喝水页</Link>
              </main>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(await screen.findByText('公告加载中…')).toBeInTheDocument()
    expect(promoRegion().getByRole('status')).toHaveTextContent('公告加载中…')
    expect(screen.getByRole('button', { name: '喝一口，从瓶中取水 20 毫升' })).toBeEnabled()
    expect(screen.queryByRole('link', { name: PROMO_LINK_NAME })).not.toBeInTheDocument()

    act(() => promoPreload().resolve())

    const promoLink = await screen.findByRole('link', { name: PROMO_LINK_NAME })
    expect(promoRegion().queryByRole('status')).not.toBeInTheDocument()
    expect(promoLink).toBeInTheDocument()

    fireEvent.click(promoLink)
    expect(await screen.findByRole('heading', { name: '塔罗测试路由' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '返回喝水页' }))

    expect(await screen.findByRole('heading', { name: '今日喝水记录' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: PROMO_LINK_NAME })).toBeInTheDocument()
    expect(promoRegion().queryByRole('status')).not.toBeInTheDocument()
    expect(promoPreloads()).toHaveLength(1)
  })
})

class ControlledImage {
  static instances: ControlledImage[] = []

  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  complete = false
  naturalWidth = 0
  naturalHeight = 0
  private source = ''

  get src() {
    return this.source
  }

  set src(value: string) {
    this.source = value
    ControlledImage.instances.push(this)
  }

  resolve() {
    this.complete = true
    this.naturalWidth = 1536
    this.naturalHeight = 640
    this.onload?.()
  }

  reject() {
    this.complete = true
    this.naturalWidth = 0
    this.naturalHeight = 0
    this.onerror?.()
  }
}

function installControlledImage() {
  ControlledImage.instances = []
  vi.stubGlobal('Image', ControlledImage as unknown as typeof Image)
}

function promoPreloads() {
  return ControlledImage.instances.filter((image) =>
    image.src.includes('snoopy-tarot-banner-v1.webp'),
  )
}

function promoPreload() {
  const matches = promoPreloads()
  expect(matches).toHaveLength(1)
  return matches[0]
}

function promoRegion() {
  return within(screen.getByRole('region', { name: '今日喝水进度' }))
}

function readyState() {
  return {
    waterMl: 0,
    bottleRemainingMl: 1000,
    totalMl: 0,
    completedBottles: 0,
    date: '2026-07-28',
    bottleCapacityMl: 1000,
    dailyBottleLimit: 2,
    dailyLimitReached: false,
    remainingDailyMl: 2000,
    redeemedAmount: 0,
    tarotPromoEnabled: true,
  }
}
