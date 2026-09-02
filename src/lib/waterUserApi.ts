/**
 * Browser client for the public water-reward Edge Function.
 *
 * The publishable key is intentionally public and is sent only as `apikey`.
 * Device credentials are scoped to this browser and persisted locally; water,
 * reward and redemption records remain authoritative on the server.
 */

export type WaterUserCouponStatus = 'issued' | 'redemption_requested' | 'redeemed'
export type WaterUserMode = 'mock' | 'remote' | 'misconfigured'

export interface WaterUserState {
  /** Amount already consumed from the current bottle; this follows the server contract. */
  waterMl: number
  /** Amount still visible in the current full-to-empty bottle experience. */
  bottleRemainingMl: number
  totalMl: number
  completedBottles: number
  date: string
  bottleCapacityMl: number
  dailyBottleLimit: number
  dailyLimitReached: boolean
  remainingDailyMl: number
  /** Sum of this user's redeemed cash_N coupons; mystery rewards have no fixed cash value. */
  redeemedAmount: number
  /** Server-controlled visibility of the water-page tarot promotion. */
  tarotPromoEnabled: boolean
}

export interface WaterUserCoupon {
  id: string
  code: string
  lookupKey: string
  rewardId: string | null
  rewardKey: string | null
  rewardName: string
  rewardDescription: string
  status: WaterUserCouponStatus
  createdAt: string
  requestedAt: string | null
  redeemedAt: string | null
  requestId: string | null
  scratchedAt?: string | null
}

export interface AddWaterResult {
  state: WaterUserState
  newCoupons: WaterUserCoupon[]
  appliedAmountMl: number
  recovered: boolean
  recoveredAmountMl?: number
}

export interface WaterPublicSettings {
  tarotPromoEnabled: boolean
  updatedAt: string | null
}

interface WaterUserConfig {
  endpoint: string | null
  publishableKey: string | null
  mock: boolean
}

interface DeviceCredentials {
  deviceId: string
  deviceToken: string
}

interface PendingWaterOperation {
  amountMl: 20 | 250
  requestId: string
}

interface MockUserState {
  date: string
  waterMl: number
  totalMl: number
  completedBottles: number
  ownedCouponCodes: string[]
}

interface MockLedger {
  coupons: unknown[]
  rewards: unknown[]
  settings: WaterPublicSettings
}

interface ApiEnvelope<T> {
  ok?: boolean
  data?: T
  error?: { code?: string; message?: string } | string
  code?: string
  message?: string
}

type UnknownRecord = Record<string, unknown>

const USER_FUNCTION_NAME = 'water-rewards-api'
const BOTTLE_CAPACITY_ML = 1000
const DAILY_BOTTLE_LIMIT = 2
const DAILY_LIMIT_ML = BOTTLE_CAPACITY_ML * DAILY_BOTTLE_LIMIT
const VALID_AMOUNTS = [20, 250] as const
const STORAGE_KEYS = {
  device: 'water-user-device-v1',
  pendingRegistration: 'water-user-pending-registration-v1',
  pendingWater: 'water-user-pending-water-v1',
  pendingRedeem: 'water-user-pending-redeem-v1',
  mockState: 'water-user-mock-state-v2',
  pendingScratch: 'water-user-pending-scratch-v1',
  scratchedCoupons: 'water-user-scratched-coupons-v1',
  ownedCoupons: 'water-user-owned-coupons-v1',
  sharedAdminLedger: 'water-admin-mock-db-v2',
} as const

let registrationPromise: Promise<DeviceCredentials> | null = null

export class WaterUserApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code = 'WATER_USER_API_ERROR', status = 0) {
    super(message)
    this.name = 'WaterUserApiError'
    this.code = code
    this.status = status
  }
}

export function getWaterUserMode(): WaterUserMode {
  const config = getConfig()
  if (config.mock) return 'mock'
  return config.endpoint && config.publishableKey ? 'remote' : 'misconfigured'
}

export async function getWaterPublicSettings(): Promise<WaterPublicSettings> {
  if (getWaterUserMode() === 'mock') {
    await mockLatency()
    return readMockLedger().settings
  }

  const data = await requestRemote<unknown>('getSettings')
  const record = asRecord(data)
  return normalizePublicSettings(record.settings ?? data)
}

export async function getWaterUserState(): Promise<WaterUserState> {
  if (getWaterUserMode() === 'mock') {
    await mockLatency()
    const state = readMockUserState()
    const ledger = readMockLedger()
    return normalizeState({
      ...state,
      redeemedAmount: mockRedeemedAmount(state, ledger),
      tarotPromoEnabled: ledger.settings.tarotPromoEnabled,
    })
  }

  const credentials = await ensureDevice()
  const data = await requestRemote<unknown>('getState', {}, credentials)
  const record = asRecord(data)
  return normalizeState(record.state ?? data)
}

export async function addWater(amountMl: 20 | 250): Promise<AddWaterResult> {
  if (!VALID_AMOUNTS.includes(amountMl)) {
    throw new WaterUserApiError('每次喝水记录只能选择一口 20ml 或一杯 250ml。', 'INVALID_AMOUNT', 400)
  }

  if (getWaterUserMode() === 'mock') {
    await mockLatency()
    const state = readMockUserState()
    const remainingDailyMl = Math.max(0, DAILY_LIMIT_ML - state.totalMl)
    if (remainingDailyMl === 0) {
      throw new WaterUserApiError(
        '今天已喝空 2 瓶，今日喝水记录已完成。',
        'WATER_DAILY_BOTTLE_LIMIT_REACHED',
        409,
      )
    }
    const ledger = readMockLedger()
    const newCoupons: WaterUserCoupon[] = []
    const appliedAmountMl = Math.min(amountMl, remainingDailyMl)
    state.waterMl += appliedAmountMl
    state.totalMl += appliedAmountMl

    while (state.waterMl >= BOTTLE_CAPACITY_ML && state.completedBottles < DAILY_BOTTLE_LIMIT) {
      state.waterMl -= BOTTLE_CAPACITY_ML
      state.completedBottles += 1
      const coupon = issueMockCoupon(ledger)
      ledger.coupons.unshift(coupon)
      state.ownedCouponCodes.unshift(coupon.code)
      newCoupons.push(coupon)
    }

    state.ownedCouponCodes = uniqueStrings(state.ownedCouponCodes)
    saveMockUserState(state)
    saveOwnedCouponCodes(state.ownedCouponCodes)
    saveMockLedger(ledger)
    return {
      state: normalizeState({
        ...state,
        redeemedAmount: mockRedeemedAmount(state, ledger),
      }),
      newCoupons,
      appliedAmountMl,
      recovered: false,
    }
  }

  const credentials = await ensureDevice()
  const pending = readPendingWaterOperation()
  let recoveredResult: AddWaterResult | null = null

  if (pending) {
    recoveredResult = await submitWaterOperation(pending, credentials, true)
    if (pending.amountMl === amountMl) return recoveredResult
    if (recoveredResult.state.dailyLimitReached) return recoveredResult
  }

  const operation: PendingWaterOperation = { amountMl, requestId: createUuid() }
  const currentResult = await submitWaterOperation(operation, credentials, false)
  if (!recoveredResult || !pending) return currentResult

  const coupons = [...recoveredResult.newCoupons, ...currentResult.newCoupons]
    .filter((coupon, index, all) => all.findIndex((item) => item.code === coupon.code) === index)
  return {
    ...currentResult,
    newCoupons: coupons,
    recovered: true,
    recoveredAmountMl: recoveredResult.appliedAmountMl,
  }
}

export async function listWaterUserCoupons(): Promise<WaterUserCoupon[]> {
  if (getWaterUserMode() === 'mock') {
    await mockLatency()
    const ownedCodes = new Set([
      ...readMockUserState().ownedCouponCodes,
      ...readOwnedCouponCodes(),
    ])
    return readMockLedger().coupons
      .map(normalizeCoupon)
      .filter((coupon) => ownedCodes.has(coupon.code))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
  }

  const credentials = await ensureDevice()
  const data = await requestRemote<unknown>('listCoupons', {}, credentials)
  const record = asRecord(data)
  const rows = Array.isArray(data) ? data : record.coupons ?? record.items ?? []
  const coupons = Array.isArray(rows) ? rows.map(normalizeCoupon) : []
  rememberOwnedCoupons(coupons.map((coupon) => coupon.code))
  return coupons.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export async function requestWaterCouponRedeem(coupon: WaterUserCoupon): Promise<WaterUserCoupon> {
  const normalized = normalizeCoupon(coupon)
  if (!normalized.code) throw new WaterUserApiError('刮刮乐编号不能为空。', 'INVALID_COUPON', 400)

  if (getWaterUserMode() === 'mock') {
    await mockLatency()
    const ledger = readMockLedger()
    const index = ledger.coupons.findIndex((item) => normalizeCoupon(item).code === normalized.code)
    if (index < 0) throw new WaterUserApiError('没有找到这张刮刮乐。', 'COUPON_NOT_FOUND', 404)
    const current = normalizeCoupon(ledger.coupons[index])
    if (current.status === 'redeemed') {
      throw new WaterUserApiError('这份奖励已经兑换完成。', 'COUPON_REDEEMED', 409)
    }
    if (current.status === 'redemption_requested') return current

    const next: WaterUserCoupon = {
      ...current,
      status: 'redemption_requested',
      requestedAt: new Date().toISOString(),
      requestId: createUuid(),
    }
    ledger.coupons[index] = next
    saveMockLedger(ledger)
    return next
  }

  const credentials = await ensureDevice()
  const pendingMap = readStringMap(STORAGE_KEYS.pendingRedeem)
  const requestId = validUuid(pendingMap[normalized.code]) ? pendingMap[normalized.code] : createUuid()
  writeStorage(STORAGE_KEYS.pendingRedeem, { ...pendingMap, [normalized.code]: requestId })

  try {
    const data = await requestRemote<unknown>('requestRedeem', {
      couponCode: normalized.code,
      rewardKey: normalized.rewardKey,
      rewardName: normalized.rewardName,
      rewardDescription: normalized.rewardDescription,
      requestId,
    }, credentials)
    const nextMap = readStringMap(STORAGE_KEYS.pendingRedeem)
    delete nextMap[normalized.code]
    writeStorage(STORAGE_KEYS.pendingRedeem, nextMap)
    const record = asRecord(data)
    return normalizeCoupon(record.coupon ?? record.item ?? data)
  } catch (error) {
    if (isDefinitiveClientError(error)) {
      const nextMap = readStringMap(STORAGE_KEYS.pendingRedeem)
      delete nextMap[normalized.code]
      writeStorage(STORAGE_KEYS.pendingRedeem, nextMap)
    }
    throw error
  }
}

export function getPendingScratchCoupon(): WaterUserCoupon | null {
  const value = readStorage<unknown>(STORAGE_KEYS.pendingScratch, null)
  if (!value || !asRecord(value).code) return null
  return normalizeCoupon(value)
}

export function setPendingScratchCoupon(coupon: WaterUserCoupon | null): void {
  if (!coupon) {
    removeStorage(STORAGE_KEYS.pendingScratch)
    return
  }
  writeStorage(STORAGE_KEYS.pendingScratch, normalizeCoupon(coupon))
}

export function markWaterCouponScratched(code: string): string {
  const normalizedCode = code.trim()
  if (!normalizedCode) return ''
  const scratched = readStringMap(STORAGE_KEYS.scratchedCoupons)
  const timestamp = scratched[normalizedCode] || new Date().toISOString()
  scratched[normalizedCode] = timestamp
  writeStorage(STORAGE_KEYS.scratchedCoupons, scratched)
  return timestamp
}

export function getWaterCouponScratchedAt(code: string): string {
  return readStringMap(STORAGE_KEYS.scratchedCoupons)[code.trim()] || ''
}

async function ensureDevice(): Promise<DeviceCredentials> {
  if (getWaterUserMode() !== 'remote') {
    if (getWaterUserMode() === 'misconfigured') throw configurationError()
    return { deviceId: 'mock-device', deviceToken: 'mock-device-token' }
  }

  const cached = readStorage<DeviceCredentials | null>(STORAGE_KEYS.device, null)
  if (cached && validUuid(cached.deviceId) && cached.deviceToken?.length >= 32) return cached
  if (registrationPromise) return registrationPromise

  const savedRequestId = readStorage<string | null>(STORAGE_KEYS.pendingRegistration, null)
  const requestId = validUuid(savedRequestId) ? savedRequestId : createUuid()
  writeStorage(STORAGE_KEYS.pendingRegistration, requestId)

  registrationPromise = requestRemote<unknown>('registerDevice', { requestId })
    .then((data) => {
      const record = asRecord(data)
      const credentials = {
        deviceId: stringValue(record.deviceId ?? record.device_id),
        deviceToken: stringValue(record.deviceToken ?? record.device_token),
      }
      if (!validUuid(credentials.deviceId) || credentials.deviceToken.length < 32) {
        throw new WaterUserApiError('设备注册响应不完整。', 'INVALID_REGISTRATION_RESPONSE')
      }
      writeStorage(STORAGE_KEYS.device, credentials)
      removeStorage(STORAGE_KEYS.pendingRegistration)
      return credentials
    })
    .catch((error) => {
      if (isDefinitiveClientError(error)) removeStorage(STORAGE_KEYS.pendingRegistration)
      throw error
    })
    .finally(() => { registrationPromise = null })

  return registrationPromise
}

async function requestRemote<T>(
  action: string,
  payload: UnknownRecord = {},
  credentials?: DeviceCredentials,
): Promise<T> {
  const config = getConfig()
  if (!config.endpoint || !config.publishableKey || config.mock) throw configurationError()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: config.publishableKey,
  }
  if (credentials) {
    headers['x-water-device-id'] = credentials.deviceId
    headers['x-water-device-token'] = credentials.deviceToken
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  let response: Response
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError'
    throw new WaterUserApiError(
      timedOut ? '请求超时，请检查网络后重试。' : '无法连接喝水记录服务，请稍后重试。',
      timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      timedOut ? 408 : 0,
    )
  } finally {
    window.clearTimeout(timeout)
  }

  let body: ApiEnvelope<T> | T | null = null
  try {
    body = await response.json() as ApiEnvelope<T> | T
  } catch {
    // The status-specific message below is clearer than a JSON parsing error.
  }
  const envelope = asRecord(body) as ApiEnvelope<T>
  if (!response.ok || envelope.ok === false) {
    const rawError = envelope.error
    const errorRecord = typeof rawError === 'string' ? { message: rawError } : rawError
    throw new WaterUserApiError(
      errorRecord?.message || envelope.message || httpErrorMessage(response.status),
      errorRecord?.code || envelope.code || `HTTP_${response.status}`,
      response.status,
    )
  }
  return (envelope.data === undefined ? body : envelope.data) as T
}

async function submitWaterOperation(
  operation: PendingWaterOperation,
  credentials: DeviceCredentials,
  recovered: boolean,
): Promise<AddWaterResult> {
  writeStorage(STORAGE_KEYS.pendingWater, operation)
  try {
    const data = await requestRemote<unknown>('addWater', {
      amountMl: operation.amountMl,
      requestId: operation.requestId,
    }, credentials)
    removeStorage(STORAGE_KEYS.pendingWater)
    const record = asRecord(data)
    const rawCoupons = record.newCoupons ?? record.awardedCoupons ?? record.issuedCoupons ??
      (record.coupon ? [record.coupon] : [])
    const newCoupons = Array.isArray(rawCoupons) ? rawCoupons.map(normalizeCoupon) : []
    rememberOwnedCoupons(newCoupons.map((coupon) => coupon.code))
    return {
      state: normalizeState(record.state ?? data),
      newCoupons,
      appliedAmountMl: Math.max(0, Math.round(numberValue(
        record.appliedAmountMl ?? record.applied_amount_ml,
        operation.amountMl,
      ))),
      recovered,
      recoveredAmountMl: recovered
        ? Math.max(0, Math.round(numberValue(
          record.appliedAmountMl ?? record.applied_amount_ml,
          operation.amountMl,
        )))
        : undefined,
    }
  } catch (error) {
    if (isDefinitiveClientError(error)) removeStorage(STORAGE_KEYS.pendingWater)
    throw error
  }
}

function getConfig(): WaterUserConfig {
  const env = import.meta.env as Record<string, string | boolean | undefined>
  const baseUrl = stringValue(env.VITE_WATER_SUPABASE_URL)
  const publishableKey = stringValue(env.VITE_WATER_SUPABASE_PUBLISHABLE_KEY)
  const functionName = stringValue(env.VITE_WATER_USER_API_FUNCTION) || USER_FUNCTION_NAME
  const mockSetting = stringValue(env.VITE_WATER_USER_MOCK).toLowerCase()
  const mock = mockSetting === 'true' || mockSetting === '1' ||
    (!baseUrl && !publishableKey && mockSetting !== 'false')
  return {
    endpoint: baseUrl ? `${baseUrl.replace(/\/$/, '')}/functions/v1/${functionName}` : null,
    publishableKey: publishableKey || null,
    mock,
  }
}

function normalizeState(value: unknown): WaterUserState {
  const record = asRecord(value)
  const capacity = Math.max(1, numberValue(record.bottleCapacityMl ?? record.bottle_capacity_ml, BOTTLE_CAPACITY_ML))
  const dailyBottleLimit = Math.max(1, Math.round(numberValue(
    record.dailyBottleLimit ?? record.daily_bottle_limit,
    DAILY_BOTTLE_LIMIT,
  )))
  const dailyLimitMl = capacity * dailyBottleLimit
  let waterMl = numberValue(record.waterMl ?? record.water_ml ?? record.currentMl ?? record.current_ml, 0)
  waterMl = ((Math.round(waterMl) % capacity) + capacity) % capacity
  const totalMl = Math.min(dailyLimitMl, Math.max(0, Math.round(numberValue(
    record.totalMl ?? record.total_ml ?? record.todayTotalMl ?? record.today_total_ml ?? record.dailyTotalMl,
    waterMl,
  ))))
  const completedBottles = Math.min(dailyBottleLimit, Math.max(0, Math.round(numberValue(
    record.completedBottles ?? record.completed_bottles ?? record.bottlesCompleted,
    Math.floor(totalMl / capacity),
  ))))
  const remainingDailyMl = Math.min(dailyLimitMl, Math.max(0, Math.round(numberValue(
    record.remainingDailyMl ?? record.remaining_daily_ml,
    dailyLimitMl - totalMl,
  ))))
  const dailyLimitReached = booleanValue(
    record.dailyLimitReached ?? record.daily_limit_reached,
    false,
  ) || remainingDailyMl === 0 || completedBottles >= dailyBottleLimit
  // The API keeps reporting how much has been consumed in the current bottle.
  // The browser deliberately presents the inverse: a full bottle that empties.
  const bottleRemainingMl = dailyLimitReached ? 0 : capacity - waterMl
  const redeemedAmount = Math.max(0, Math.round(numberValue(
    record.redeemedAmount ?? record.redeemed_amount,
    0,
  )))
  const tarotPromoEnabled = booleanValue(
    record.tarotPromoEnabled ?? record.tarot_promo_enabled,
    true,
  )
  return {
    waterMl,
    bottleRemainingMl,
    totalMl,
    completedBottles,
    date: stringValue(record.date ?? record.localDay ?? record.local_day) || todayKey(),
    bottleCapacityMl: capacity,
    dailyBottleLimit,
    dailyLimitReached,
    remainingDailyMl,
    redeemedAmount,
    tarotPromoEnabled,
  }
}

function normalizeCoupon(value: unknown): WaterUserCoupon {
  const record = asRecord(value)
  const reward = asRecord(record.reward ?? record.prize)
  const code = stringValue(record.code ?? record.couponCode ?? record.coupon_code ?? record.uniqueCode)
  return {
    id: stringValue(record.id ?? record.couponId ?? record.coupon_id) || code,
    code,
    lookupKey: stringValue(record.lookupKey ?? record.lookup_key ?? record.adminKey ?? record.key),
    rewardId: nullableString(record.rewardId ?? record.reward_id ?? reward.id),
    rewardKey: nullableString(record.rewardKey ?? record.reward_key ?? record.rewardCode ?? reward.code),
    rewardName: stringValue(record.rewardName ?? record.reward_name ?? record.prizeName ?? reward.name) || '未命名奖励',
    rewardDescription: stringValue(
      record.rewardDescription ?? record.reward_description ?? record.rewardContent ??
      record.description ?? reward.description ?? reward.content,
    ) || '奖励内容以实际兑换为准。',
    status: normalizeStatus(record.status ?? record.redemptionStatus ?? record.redemption_status),
    createdAt: stringValue(record.createdAt ?? record.created_at ?? record.issuedAt ?? record.issued_at) || new Date().toISOString(),
    requestedAt: nullableString(record.requestedAt ?? record.requested_at ?? record.redemptionRequestedAt),
    redeemedAt: nullableString(record.redeemedAt ?? record.redeemed_at ?? record.completedAt),
    requestId: nullableString(record.requestId ?? record.request_id ?? record.redemptionRequestId),
    scratchedAt: nullableString(record.scratchedAt ?? record.scratched_at) || getWaterCouponScratchedAt(code) || null,
  }
}

function normalizePublicSettings(value: unknown): WaterPublicSettings {
  const record = asRecord(value)
  return {
    tarotPromoEnabled: booleanValue(
      record.tarotPromoEnabled ?? record.tarot_promo_enabled,
      true,
    ),
    updatedAt: nullableString(record.updatedAt ?? record.updated_at),
  }
}

function normalizeStatus(value: unknown): WaterUserCouponStatus {
  const status = stringValue(value).toLowerCase()
  if (['redemption_requested', 'requested', 'pending', 'redeem_requested'].includes(status)) {
    return 'redemption_requested'
  }
  if (['redeemed', 'completed', 'fulfilled', 'used'].includes(status)) return 'redeemed'
  return 'issued'
}

function readMockUserState(): MockUserState {
  const today = todayKey()
  const stored = asRecord(readStorage<unknown>(STORAGE_KEYS.mockState, {}))
  const storedOwnedCodes = stored.ownedCouponCodes
  const ownedCouponCodes = uniqueStrings([
    ...(Array.isArray(storedOwnedCodes) ? storedOwnedCodes.map(stringValue) : []),
    ...readOwnedCouponCodes(),
  ])
  const state: MockUserState = {
    date: stringValue(stored.date) || today,
    waterMl: Math.max(0, Math.round(numberValue(stored.waterMl, 0))),
    totalMl: Math.min(DAILY_LIMIT_ML, Math.max(0, Math.round(numberValue(stored.totalMl, 0)))),
    completedBottles: Math.min(
      DAILY_BOTTLE_LIMIT,
      Math.max(0, Math.round(numberValue(stored.completedBottles, 0))),
    ),
    ownedCouponCodes,
  }
  if (state.date !== today) {
    state.date = today
    state.waterMl = 0
    state.totalMl = 0
    state.completedBottles = 0
  }
  state.completedBottles = Math.min(DAILY_BOTTLE_LIMIT, Math.floor(state.totalMl / BOTTLE_CAPACITY_ML))
  state.waterMl = state.totalMl >= DAILY_LIMIT_ML ? 0 : state.totalMl % BOTTLE_CAPACITY_ML
  saveMockUserState(state)
  return state
}

function saveMockUserState(state: MockUserState): void {
  writeStorage(STORAGE_KEYS.mockState, state)
}

function readMockLedger(): MockLedger {
  const stored = readStorage<Partial<MockLedger> | null>(STORAGE_KEYS.sharedAdminLedger, null)
  if (stored && Array.isArray(stored.coupons) && Array.isArray(stored.rewards)) {
    return {
      coupons: stored.coupons,
      rewards: stored.rewards,
      settings: normalizePublicSettings(stored.settings),
    }
  }
  const ledger = createMockLedger()
  saveMockLedger(ledger)
  return ledger
}

function saveMockLedger(ledger: MockLedger): void {
  writeStorage(STORAGE_KEYS.sharedAdminLedger, ledger)
}

function mockRedeemedAmount(state: MockUserState, ledger: MockLedger): number {
  const ownedCodes = new Set([
    ...state.ownedCouponCodes,
    ...readOwnedCouponCodes(),
  ])

  return ledger.coupons
    .map(normalizeCoupon)
    .filter((coupon) => ownedCodes.has(coupon.code) && coupon.status === 'redeemed')
    .reduce((total, coupon) => total + cashAmountFromRewardKey(coupon.rewardKey), 0)
}

function cashAmountFromRewardKey(rewardKey: string | null): number {
  const match = rewardKey?.match(/^cash_(\d+)$/i)
  if (!match) return 0
  const amount = Number(match[1])
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0
}

function createMockLedger(): MockLedger {
  const now = new Date().toISOString()
  return {
    coupons: [],
    settings: { tarotPromoEnabled: true, updatedAt: now },
    rewards: [
      mockReward('reward-cash-10', 'cash_10', '10元现金红包', '线下兑换10元现金红包。', 3000, 10, now),
      mockReward('reward-cash-20', 'cash_20', '20元现金红包', '线下兑换20元现金红包。', 2500, 20, now),
      mockReward('reward-cash-30', 'cash_30', '30元现金红包', '线下兑换30元现金红包。', 1800, 30, now),
      mockReward('reward-cash-50', 'cash_50', '50元现金红包', '线下兑换50元现金红包。', 1300, 40, now),
      mockReward('reward-cash-66', 'cash_66', '66元现金红包', '线下兑换66元现金红包。', 700, 50, now),
      mockReward('reward-cash-88', 'cash_88', '88元现金红包', '线下兑换88元现金红包。', 400, 60, now),
      mockReward('reward-cash-100', 'cash_100', '100元现金红包', '线下兑换100元现金红包。', 200, 70, now),
      mockReward('reward-cash-200', 'cash_200', '200元现金红包', '线下兑换200元现金红包。', 70, 80, now),
      mockReward('reward-cash-520', 'cash_520', '520元现金红包', '线下兑换520元现金红包。', 29, 90, now),
      mockReward('reward-super-mystery', 'super_mystery', '超级神秘大奖', '线下兑换超级神秘大奖。', 1, 100, now),
    ],
  }
}

function mockReward(
  id: string,
  code: string,
  name: string,
  description: string,
  weight: number,
  sortOrder: number,
  timestamp: string,
) {
  return { id, code, name, description, weight, enabled: true, sortOrder, createdAt: timestamp, updatedAt: timestamp }
}

function issueMockCoupon(ledger: MockLedger): WaterUserCoupon {
  const rewards = ledger.rewards.map((item) => {
    const record = asRecord(item)
    return {
      id: stringValue(record.id),
      code: stringValue(record.code ?? record.rewardKey ?? record.reward_key),
      name: stringValue(record.name ?? record.rewardName) || '未命名奖励',
      description: stringValue(record.description ?? record.rewardDescription),
      weight: Math.max(0, numberValue(record.weight, 0)),
      enabled: booleanValue(record.enabled, true),
    }
  }).filter((reward) => reward.enabled && reward.weight > 0)
  if (!rewards.length) throw new WaterUserApiError('当前没有可用奖励。', 'REWARD_POOL_EMPTY', 503)

  const totalWeight = rewards.reduce((sum, reward) => sum + reward.weight, 0)
  let cursor = Math.random() * totalWeight
  const selected = rewards.find((reward) => {
    cursor -= reward.weight
    return cursor < 0
  }) ?? rewards[rewards.length - 1]

  const existing = ledger.coupons.map(normalizeCoupon)
  const createdAt = new Date().toISOString()
  return {
    id: createUuid(),
    code: uniqueMockCode('H2O', new Set(existing.map((coupon) => coupon.code))),
    lookupKey: uniqueMockCode('LOVE', new Set(existing.map((coupon) => coupon.lookupKey))),
    rewardId: selected.id || null,
    rewardKey: selected.code || null,
    rewardName: selected.name,
    rewardDescription: selected.description || '奖励内容以实际兑换为准。',
    status: 'issued',
    createdAt,
    requestedAt: null,
    redeemedAt: null,
    requestId: null,
    scratchedAt: null,
  }
}

function uniqueMockCode(prefix: string, existing: Set<string>): string {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const token = createUuid().replace(/-/g, '').slice(0, 12).toUpperCase()
    const candidate = `${prefix}-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`
    if (!existing.has(candidate)) return candidate
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function readPendingWaterOperation(): PendingWaterOperation | null {
  const value = readStorage<Partial<PendingWaterOperation> | null>(STORAGE_KEYS.pendingWater, null)
  if (!value || !VALID_AMOUNTS.includes(value.amountMl as 20 | 250) || !validUuid(value.requestId)) return null
  return { amountMl: value.amountMl as 20 | 250, requestId: value.requestId! }
}

function readOwnedCouponCodes(): string[] {
  const stored = readStorage<unknown>(STORAGE_KEYS.ownedCoupons, [])
  return uniqueStrings(Array.isArray(stored) ? stored.map(stringValue) : [])
}

function rememberOwnedCoupons(codes: string[]): void {
  saveOwnedCouponCodes([...readOwnedCouponCodes(), ...codes])
}

function saveOwnedCouponCodes(codes: string[]): void {
  writeStorage(STORAGE_KEYS.ownedCoupons, uniqueStrings(codes))
}

function isDefinitiveClientError(error: unknown): boolean {
  return error instanceof WaterUserApiError && error.status >= 400 && error.status < 500 &&
    ![408, 429].includes(error.status)
}

function configurationError() {
  return new WaterUserApiError(
    '喝水记录服务尚未配置，请检查 VITE_WATER_SUPABASE_URL、publishable key 和 mock 开关。',
    'WATER_API_NOT_CONFIGURED',
  )
}

function httpErrorMessage(status: number) {
  if (status === 401 || status === 403) return '设备凭据已失效，请清除本站点数据后重试。'
  if (status === 404) return '喝水记录服务尚未部署。'
  if (status === 408) return '请求超时，请稍后重试。'
  if (status === 429) return '操作太频繁，请休息一下再试。'
  if (status >= 500) return '服务暂时不可用，请稍后再试。'
  return `请求失败（${status || '未知状态'}）。`
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage failures should not expose credentials or crash the current UI.
  }
}

function removeStorage(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore unavailable browser storage.
  }
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableString(value: unknown): string | null {
  const result = stringValue(value)
  return result || null
}

function numberValue(value: unknown, fallback = 0): number {
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function readStringMap(key: string): Record<string, string> {
  const record = asRecord(readStorage<unknown>(key, {}))
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

async function mockLatency(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, import.meta.env.MODE === 'test' ? 1 : 120))
}
