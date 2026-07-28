import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

describe('WaterUserPage refresh sequencing', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  afterEach(() => vi.useRealTimers())

  it('clears the initial loading state when a quiet refresh supersedes it', async () => {
    let resolveInitialState!: (value: unknown) => void
    let resolveInitialCoupons!: (value: unknown[]) => void
    const initialState = new Promise((resolve) => { resolveInitialState = resolve })
    const initialCoupons = new Promise<unknown[]>((resolve) => { resolveInitialCoupons = resolve })
    const readyState = { waterMl: 0, totalMl: 0, completedBottles: 0, date: '2026-07-28', bottleCapacityMl: 1000 }

    api.getState.mockImplementationOnce(() => initialState).mockResolvedValue(readyState)
    api.listCoupons.mockImplementationOnce(() => initialCoupons).mockResolvedValue([])

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '刮刮乐' }))
    const refreshButton = await screen.findByRole('button', { name: '刷新刮刮乐' })
    await waitFor(() => expect(refreshButton).not.toBeDisabled())

    await act(async () => {
      resolveInitialState(readyState)
      resolveInitialCoupons([])
      await Promise.all([initialState, initialCoupons])
    })
  })

  it('plays eight 180ms frames before showing settlement and releasing the buttons', async () => {
    vi.useFakeTimers()
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
    api.getState.mockResolvedValue(readyState())
    api.listCoupons.mockResolvedValue([])
    api.addWater.mockRejectedValue(new Error('测试喝水记录失败'))

    render(
      <MemoryRouter>
        <WaterUserPage />
      </MemoryRouter>,
    )
    await act(async () => { await Promise.resolve() })

    const cupButton = screen.getByRole('button', { name: '喝一杯，从瓶中取水 250 毫升' })
    fireEvent.click(cupButton)
    await act(async () => { await vi.advanceTimersByTimeAsync(1439) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(cupButton).toBeDisabled()

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByRole('alert')).toHaveTextContent('测试喝水记录失败')
    expect(cupButton).toBeEnabled()
  })
})

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
  }
}
