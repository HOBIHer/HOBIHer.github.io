import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getWaterSettings,
  getWaterApiMode,
  listWaterCoupons,
  listWaterRewards,
  loginWaterAdmin,
  markWaterCouponRedeemed,
  updateWaterSettings,
  upsertWaterReward,
} from '../lib/waterApi'

describe('water reward admin mock', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() })
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.stubEnv('VITE_WATER_ADMIN_MOCK', 'true')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('keeps demo credentials and coupon state transitions testable offline', async () => {
    expect(getWaterApiMode()).toBe('mock')
    await expect(loginWaterAdmin('admin', 'wrong')).rejects.toThrow('用户名或密码不正确')

    const session = await loginWaterAdmin('admin', 'admin')
    const page = await listWaterCoupons(session)
    const requested = page.coupons.find((coupon) => coupon.status === 'redemption_requested')

    expect(page.stats.total).toBeGreaterThan(0)
    expect(page.stats.redeemedAmount).toBe(10)
    expect(requested).toBeDefined()

    const redeemed = await markWaterCouponRedeemed(session, requested!)
    expect(redeemed.status).toBe('redeemed')

    const refreshed = await listWaterCoupons(session, { query: redeemed.lookupKey })
    expect(refreshed.coupons).toHaveLength(1)
    expect(refreshed.coupons[0].status).toBe('redeemed')
    expect(refreshed.stats.redeemedAmount).toBe(20)
  })

  it('counts only redeemed fixed-cash rewards in the mock amount', async () => {
    const session = await loginWaterAdmin('admin', 'admin')
    await listWaterCoupons(session)

    const database = JSON.parse(window.localStorage.getItem('water-admin-mock-db-v2')!)
    const now = new Date().toISOString()
    database.coupons.push(
      {
        id: 'coupon-redeemed-mystery',
        code: 'H2O-MYSTERY',
        lookupKey: 'LOVE-MYSTERY',
        rewardId: 'reward-super-mystery',
        rewardCode: 'super_mystery',
        rewardName: '超级神秘大奖',
        rewardDescription: '',
        status: 'redeemed',
        createdAt: now,
        requestedAt: now,
        redeemedAt: now,
        requestId: 'request-mystery',
      },
      {
        id: 'coupon-redeemed-cash-88',
        code: 'H2O-CASH-88',
        lookupKey: 'LOVE-CASH-88',
        rewardId: 'reward-cash-88',
        rewardCode: 'cash_88',
        rewardName: '88元现金红包',
        rewardDescription: '',
        status: 'redeemed',
        createdAt: now,
        requestedAt: now,
        redeemedAt: now,
        requestId: 'request-cash-88',
      },
      {
        id: 'coupon-issued-cash-520',
        code: 'H2O-CASH-520',
        lookupKey: 'LOVE-CASH-520',
        rewardId: 'reward-cash-520',
        rewardCode: 'cash_520',
        rewardName: '520元现金红包',
        rewardDescription: '',
        status: 'issued',
        createdAt: now,
        requestedAt: null,
        redeemedAt: null,
        requestId: null,
      },
    )
    window.localStorage.setItem('water-admin-mock-db-v2', JSON.stringify(database))

    const page = await listWaterCoupons(session)
    expect(page.stats.redeemed).toBe(3)
    expect(page.stats.redeemedAmount).toBe(98)
  })

  it('allows the demo prize pool to be maintained', async () => {
    const session = await loginWaterAdmin('admin', 'admin')
    const before = await listWaterRewards(session)
    const created = await upsertWaterReward(session, {
      code: 'DATE_CHOICE',
      name: '50元现金红包',
      description: '线下兑换50元现金红包。',
      weight: 8,
      enabled: true,
    })
    const after = await listWaterRewards(session)

    expect(created.code).toBe('DATE_CHOICE')
    expect(after).toHaveLength(before.length + 1)
  })

  it('starts with the exact 10,000-weight cash prize pool', async () => {
    const session = await loginWaterAdmin('admin', 'admin')
    const rewards = await listWaterRewards(session)

    expect(rewards.map(({ code, weight }) => [code, weight])).toEqual([
      ['cash_10', 3000],
      ['cash_20', 2500],
      ['cash_30', 1800],
      ['cash_50', 1300],
      ['cash_66', 700],
      ['cash_88', 400],
      ['cash_100', 200],
      ['cash_200', 70],
      ['cash_520', 29],
      ['super_mystery', 1],
    ])
    expect(rewards.reduce((sum, reward) => sum + reward.weight, 0)).toBe(10_000)
  })

  it('persists the tarot promotion switch in the shared mock database', async () => {
    const session = await loginWaterAdmin('admin', 'admin')

    expect(await getWaterSettings(session)).toMatchObject({ tarotPromoEnabled: true })
    const saved = await updateWaterSettings(session, { tarotPromoEnabled: false })
    expect(saved).toMatchObject({ tarotPromoEnabled: false })
    expect(saved.updatedAt).toBeTruthy()
    expect(await getWaterSettings(session)).toEqual(saved)

    const database = JSON.parse(window.localStorage.getItem('water-admin-mock-db-v2')!)
    expect(database.settings.tarotPromoEnabled).toBe(false)
  })

  it('sends authenticated settings updates to the remote admin function', async () => {
    vi.stubEnv('VITE_WATER_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_WATER_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_value')
    vi.stubEnv('VITE_WATER_ADMIN_MOCK', 'false')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      data: { tarotPromoEnabled: false, updatedAt: '2026-09-01T00:00:00.000Z' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateWaterSettings(
      { token: 'admin-session-token', expiresAt: '2099-01-01T00:00:00.000Z' },
      { tarotPromoEnabled: false },
    )

    expect(result.tarotPromoEnabled).toBe(false)
    const request = fetchMock.mock.calls[0][1]
    const headers = new Headers(request?.headers)
    const body = JSON.parse(String(request?.body))
    expect(headers.get('apikey')).toBe('sb_publishable_test_value')
    expect(headers.get('authorization')).toBe('Bearer admin-session-token')
    expect(body).toMatchObject({
      action: 'updateSettings',
      settings: { tarotPromoEnabled: false },
    })
  })
})

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
