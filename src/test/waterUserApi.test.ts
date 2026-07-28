import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
} from '../lib/waterUserApi'
import {
  listWaterCoupons,
  loginWaterAdmin,
  markWaterCouponRedeemed,
} from '../lib/waterApi'

describe('water user browser flow', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() })
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('completes a bottle, persists scratch state, and shares redemption with admin mock', async () => {
    expect(getWaterUserMode()).toBe('mock')
    expect(await getWaterUserState()).toMatchObject({
      waterMl: 0,
      bottleRemainingMl: 1000,
      redeemedAmount: 0,
    })

    await addWater(250)
    await addWater(250)
    await addWater(250)
    const completed = await addWater(250)

    expect(completed.state.waterMl).toBe(0)
    expect(completed.state.bottleRemainingMl).toBe(1000)
    expect(completed.state.totalMl).toBe(1000)
    expect(completed.state.completedBottles).toBe(1)
    expect(completed.newCoupons).toHaveLength(1)

    const coupon = completed.newCoupons[0]
    expect(coupon.code).toMatch(/^H2O-/)
    expect(coupon.lookupKey).toMatch(/^LOVE-/)
    setPendingScratchCoupon(coupon)
    expect(getPendingScratchCoupon()?.code).toBe(coupon.code)
    const scratchedAt = markWaterCouponScratched(coupon.code)
    expect(getWaterCouponScratchedAt(coupon.code)).toBe(scratchedAt)

    const requested = await requestWaterCouponRedeem(coupon)
    expect(requested.status).toBe('redemption_requested')

    const adminSession = await loginWaterAdmin('admin', 'admin')
    const adminPage = await listWaterCoupons(adminSession, { query: coupon.lookupKey })
    expect(adminPage.coupons).toHaveLength(1)
    expect(adminPage.coupons[0].rewardName).toBe(coupon.rewardName)

    await markWaterCouponRedeemed(adminSession, adminPage.coupons[0])
    const refreshed = await listWaterUserCoupons()
    expect(refreshed).toHaveLength(1)
    expect(refreshed[0].status).toBe('redeemed')
  })

  it('issues a different coupon instance for every completed bottle', async () => {
    const issued = []
    for (let bottle = 0; bottle < 2; bottle += 1) {
      for (let cup = 0; cup < 4; cup += 1) {
        const result = await addWater(250)
        issued.push(...result.newCoupons)
      }
    }

    expect(issued).toHaveLength(2)
    expect(new Set(issued.map((coupon) => coupon.code)).size).toBe(2)
    expect(new Set(issued.map((coupon) => coupon.lookupKey)).size).toBe(2)
  })

  it.each([
    [0.997, 'cash_520', '520元现金红包'],
    [0.99995, 'super_mystery', '超级神秘大奖'],
  ])('selects the rare cash-pool boundary at random=%s', async (random, rewardKey, rewardName) => {
    vi.spyOn(Math, 'random').mockReturnValue(random)

    let coupon = null
    for (let cup = 0; cup < 4; cup += 1) {
      const result = await addWater(250)
      coupon = result.newCoupons[0] ?? coupon
    }

    expect(coupon).toMatchObject({ rewardKey, rewardName })
  })

  it('partially applies the final drink and rejects water after two bottles', async () => {
    for (let cup = 0; cup < 7; cup += 1) await addWater(250)
    for (let sip = 0; sip < 11; sip += 1) await addWater(20)

    const completed = await addWater(250)
    expect(completed.appliedAmountMl).toBe(30)
    expect(completed.state).toMatchObject({
      waterMl: 0,
      totalMl: 2000,
      completedBottles: 2,
      dailyBottleLimit: 2,
      dailyLimitReached: true,
      remainingDailyMl: 0,
      bottleRemainingMl: 0,
    })
    expect(completed.newCoupons).toHaveLength(1)
    await expect(addWater(20)).rejects.toMatchObject({
      code: 'WATER_DAILY_BOTTLE_LIMIT_REACHED',
      status: 409,
      message: '今天已喝空 2 瓶，今日喝水记录已完成。',
    })
  })

  it('sends a publishable key as apikey rather than a bearer JWT', async () => {
    vi.stubEnv('VITE_WATER_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_WATER_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_value')
    vi.stubEnv('VITE_WATER_USER_MOCK', 'false')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          deviceId: '11111111-1111-4111-8111-111111111111',
          deviceToken: 'abcdefghijklmnopqrstuvwxyz1234567890',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          waterMl: 20,
          totalMl: 20,
          completedBottles: 0,
          date: '2026-07-28',
          redeemed_amount: 88,
        },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const state = await getWaterUserState()
    expect(state.waterMl).toBe(20)
    expect(state.bottleRemainingMl).toBe(980)
    expect(state.redeemedAmount).toBe(88)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers)
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers)
    expect(firstHeaders.get('apikey')).toBe('sb_publishable_test_value')
    expect(firstHeaders.has('authorization')).toBe(false)
    expect(secondHeaders.get('x-water-device-id')).toBe('11111111-1111-4111-8111-111111111111')
    expect(secondHeaders.has('authorization')).toBe(false)
  })

  it('reconciles a different pending amount before applying the current click', async () => {
    vi.stubEnv('VITE_WATER_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_WATER_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_value')
    vi.stubEnv('VITE_WATER_USER_MOCK', 'false')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          deviceId: '22222222-2222-4222-8222-222222222222',
          deviceToken: 'abcdefghijklmnopqrstuvwxyz1234567890',
        },
      }))
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          state: { waterMl: 760, totalMl: 1760, completedBottles: 1 },
          newCoupons: [],
          appliedAmountMl: 20,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          state: {
            waterMl: 0,
            totalMl: 2000,
            completedBottles: 2,
            dailyBottleLimit: 2,
            dailyLimitReached: true,
            remainingDailyMl: 0,
          },
          newCoupons: [],
          appliedAmountMl: 240,
        },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(addWater(20)).rejects.toThrow('无法连接喝水记录服务')
    const recovered = await addWater(250)

    expect(recovered.state.waterMl).toBe(0)
    expect(recovered.state.dailyLimitReached).toBe(true)
    expect(recovered.appliedAmountMl).toBe(240)
    expect(recovered.recoveredAmountMl).toBe(20)
    const addBodies = fetchMock.mock.calls.slice(1).map((call) => JSON.parse(String(call[1]?.body)))
    expect(addBodies.map((body) => body.amountMl)).toEqual([20, 20, 250])
    expect(addBodies[0].requestId).toBe(addBodies[1].requestId)
    expect(addBodies[2].requestId).not.toBe(addBodies[1].requestId)
  })

  it('does not send the current click when reconciling the pending drink reaches the daily limit', async () => {
    vi.stubEnv('VITE_WATER_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_WATER_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_value')
    vi.stubEnv('VITE_WATER_USER_MOCK', 'false')

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          deviceId: '33333333-3333-4333-8333-333333333333',
          deviceToken: 'abcdefghijklmnopqrstuvwxyz1234567890',
        },
      }))
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        data: {
          state: {
            waterMl: 0,
            totalMl: 2000,
            completedBottles: 2,
            dailyBottleLimit: 2,
            dailyLimitReached: true,
            remainingDailyMl: 0,
          },
          newCoupons: [],
          appliedAmountMl: 20,
        },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(addWater(20)).rejects.toThrow('无法连接喝水记录服务')
    const recovered = await addWater(250)

    expect(recovered.appliedAmountMl).toBe(20)
    expect(recovered.recovered).toBe(true)
    expect(recovered.state.dailyLimitReached).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('sums only owned redeemed cash coupons and leaves mystery rewards unpriced', async () => {
    const now = new Date().toISOString()
    const ownedCouponCodes = ['CASH-10', 'CASH-520', 'MYSTERY', 'PENDING-CASH', 'FALLBACK']
    window.localStorage.setItem('water-user-mock-state-v2', JSON.stringify({
      date: localDayKey(),
      waterMl: 0,
      totalMl: 0,
      completedBottles: 0,
      ownedCouponCodes,
    }))
    window.localStorage.setItem('water-admin-mock-db-v2', JSON.stringify({
      rewards: [],
      coupons: [
        mockCouponRecord('CASH-10', 'CASH_10', 'redeemed', now),
        mockCouponRecord('CASH-520', 'cash_520', 'redeemed', now),
        mockCouponRecord('MYSTERY', 'super_mystery', 'redeemed', now),
        mockCouponRecord('PENDING-CASH', 'cash_200', 'redemption_requested', now),
        mockCouponRecord('FALLBACK', '', 'issued', now),
        mockCouponRecord('NOT-OWNED', 'cash_88', 'redeemed', now),
      ],
    }))

    const state = await getWaterUserState()
    expect(state.redeemedAmount).toBe(530)
    expect(state.bottleRemainingMl).toBe(1000)
    const coupons = await listWaterUserCoupons()
    expect(coupons.find((coupon) => coupon.code === 'FALLBACK')).toMatchObject({
      rewardName: '未命名奖励',
      rewardDescription: '奖励内容以实际兑换为准。',
    })
  })
})

function mockCouponRecord(code: string, rewardKey: string, status: string, createdAt: string) {
  return {
    id: `coupon-${code}`,
    code,
    lookupKey: `key-${code}`,
    rewardKey,
    rewardName: rewardKey,
    rewardDescription: '',
    status,
    createdAt,
    requestedAt: null,
    redeemedAt: status === 'redeemed' ? createdAt : null,
    requestId: null,
  }
}

function localDayKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}
