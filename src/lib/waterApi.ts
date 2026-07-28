/**
 * Browser client for the water-reward admin Edge Function.
 *
 * Only the Supabase URL and publishable key belong in Vite's public env. The
 * database password, service-role key and admin credential validation must
 * stay inside the Edge Function.
 */

export type WaterCouponStatus = 'issued' | 'redemption_requested' | 'redeemed'
export type WaterCouponFilter = 'all' | WaterCouponStatus

export interface WaterAdminSession {
  token: string
  expiresAt: string
}

export interface WaterCoupon {
  id: string
  code: string
  lookupKey: string
  rewardId: string | null
  rewardCode: string | null
  rewardName: string
  rewardDescription: string
  status: WaterCouponStatus
  createdAt: string
  requestedAt: string | null
  redeemedAt: string | null
  requestId: string | null
}

export interface WaterCouponStats {
  total: number
  issued: number
  requested: number
  redeemed: number
  redeemedAmount: number
}

export interface WaterCouponPage {
  coupons: WaterCoupon[]
  total: number
  stats: WaterCouponStats
}

export interface WaterReward {
  id: string
  code: string
  name: string
  description: string
  weight: number
  enabled: boolean
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface WaterRewardInput {
  id?: string
  code: string
  name: string
  description: string
  weight: number
  enabled: boolean
  sortOrder?: number
}

export interface ListWaterCouponsInput {
  status?: WaterCouponFilter
  query?: string
  limit?: number
  offset?: number
}

interface ApiErrorPayload {
  code?: string
  message?: string
}

interface ApiEnvelope<T> {
  ok?: boolean
  data?: T
  error?: ApiErrorPayload | string
}

interface WaterApiConfig {
  endpoint: string | null
  publishableKey: string | null
  mock: boolean
}

type UnknownRecord = Record<string, unknown>

const ADMIN_FUNCTION_NAME = 'water-rewards-admin'
const SESSION_STORAGE_KEY = 'water-admin-session-v1'
const MOCK_DB_STORAGE_KEY = 'water-admin-mock-db-v2'
const FIXED_CASH_AMOUNTS: Record<string, number> = {
  cash_10: 10,
  cash_20: 20,
  cash_30: 30,
  cash_50: 50,
  cash_66: 66,
  cash_88: 88,
  cash_100: 100,
  cash_200: 200,
  cash_520: 520,
}

export class WaterApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code = 'WATER_API_ERROR', status = 0) {
    super(message)
    this.name = 'WaterApiError'
    this.code = code
    this.status = status
  }
}

function getConfig(): WaterApiConfig {
  const env = import.meta.env as Record<string, string | boolean | undefined>
  const url = stringValue(env.VITE_WATER_SUPABASE_URL)
  const publishableKey = stringValue(env.VITE_WATER_SUPABASE_PUBLISHABLE_KEY)
  const functionName = stringValue(env.VITE_WATER_ADMIN_FUNCTION) || ADMIN_FUNCTION_NAME
  const mockSetting = stringValue(env.VITE_WATER_ADMIN_MOCK)?.toLowerCase()
  const mock = mockSetting === 'true' || mockSetting === '1' || (!url && !publishableKey && mockSetting !== 'false')

  return {
    endpoint: url ? `${url.replace(/\/$/, '')}/functions/v1/${functionName}` : null,
    publishableKey,
    mock,
  }
}

export function getWaterApiMode(): 'mock' | 'remote' | 'misconfigured' {
  const config = getConfig()
  if (config.mock) return 'mock'
  return config.endpoint && config.publishableKey ? 'remote' : 'misconfigured'
}

export function readWaterAdminSession(): WaterAdminSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UnknownRecord
    const token = stringValue(parsed.token)
    const expiresAt = stringValue(parsed.expiresAt)
    const mode = stringValue(parsed.mode)

    if (!token || !expiresAt || (mode && mode !== getWaterApiMode())) {
      clearWaterAdminSession()
      return null
    }

    if (Date.parse(expiresAt) <= Date.now()) {
      clearWaterAdminSession()
      return null
    }

    return { token, expiresAt }
  } catch {
    clearWaterAdminSession()
    return null
  }
}

export function clearWaterAdminSession(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

function saveWaterAdminSession(session: WaterAdminSession): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ ...session, mode: getWaterApiMode() }),
  )
}

export async function loginWaterAdmin(username: string, password: string): Promise<WaterAdminSession> {
  if (getWaterApiMode() === 'mock') {
    await mockLatency()
    if (username !== 'admin' || password !== 'admin') {
      throw new WaterApiError('用户名或密码不正确', 'INVALID_CREDENTIALS', 401)
    }

    const session = {
      token: `mock.${randomToken()}`,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    }
    saveWaterAdminSession(session)
    return session
  }

  const data = await callWaterAdmin<UnknownRecord>(
    { action: 'login', username, password },
    null,
  )
  const token = stringValue(data.token ?? data.accessToken ?? data.access_token ?? data.sessionToken)
  const expiresAt = normalizeExpiry(data.expiresAt ?? data.expires_at ?? data.expiresIn ?? data.expires_in)

  if (!token) throw new WaterApiError('登录响应缺少会话令牌', 'INVALID_LOGIN_RESPONSE')

  const session = { token, expiresAt }
  saveWaterAdminSession(session)
  return session
}

export async function listWaterCoupons(
  session: WaterAdminSession,
  input: ListWaterCouponsInput = {},
): Promise<WaterCouponPage> {
  if (getWaterApiMode() === 'mock') {
    await mockLatency()
    ensureMockSession(session)
    return mockListCoupons(input)
  }

  const status = input.status && input.status !== 'all' ? input.status : undefined
  const data = await callWaterAdmin<unknown>(
    {
      action: 'listCoupons',
      filters: {
        status,
        query: input.query?.trim() || undefined,
      },
      // Top-level fields keep this client compatible with the initial demo
      // contract while `filters` gives the function room to grow.
      status,
      query: input.query?.trim() || undefined,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    },
    session,
  )

  return normalizeCouponPage(data)
}

export async function getWaterCoupon(
  session: WaterAdminSession,
  query: string,
): Promise<WaterCoupon | null> {
  if (getWaterApiMode() === 'mock') {
    await mockLatency()
    ensureMockSession(session)
    const normalized = query.trim().toLowerCase()
    return readMockDatabase().coupons.map(normalizeCoupon).find((coupon) =>
      [coupon.id, coupon.code, coupon.lookupKey].some((value) => value.toLowerCase() === normalized),
    ) ?? null
  }

  const data = await callWaterAdmin<unknown>(
    { action: 'getCoupon', query: query.trim(), couponCode: query.trim(), key: query.trim() },
    session,
  )
  if (!data) return null
  const record = asRecord(data)
  const coupon = record.coupon ?? record.item ?? data
  return coupon ? normalizeCoupon(coupon) : null
}

export async function markWaterCouponRedeemed(
  session: WaterAdminSession,
  coupon: Pick<WaterCoupon, 'id' | 'code' | 'requestId'>,
): Promise<WaterCoupon> {
  if (getWaterApiMode() === 'mock') {
    await mockLatency()
    ensureMockSession(session)
    const database = readMockDatabase()
    const index = database.coupons.findIndex((item) => {
      const current = normalizeCoupon(item)
      return current.id === coupon.id || current.code === coupon.code
    })
    if (index < 0) throw new WaterApiError('没有找到这张刮刮乐', 'COUPON_NOT_FOUND', 404)

    const current = normalizeCoupon(database.coupons[index])
    if (current.status !== 'redemption_requested') {
      throw new WaterApiError('只有已申请兑换的刮刮乐才能标记完成', 'INVALID_COUPON_STATUS', 409)
    }

    const next: WaterCoupon = { ...current, status: 'redeemed', redeemedAt: new Date().toISOString() }
    database.coupons[index] = next
    saveMockDatabase(database)
    return next
  }

  const data = await callWaterAdmin<unknown>(
    {
      action: 'markRedeemed',
      couponId: coupon.id,
      couponCode: coupon.code,
      requestId: coupon.requestId,
    },
    session,
  )
  const record = asRecord(data)
  return normalizeCoupon(record.coupon ?? record.item ?? data)
}

export async function listWaterRewards(session: WaterAdminSession): Promise<WaterReward[]> {
  if (getWaterApiMode() === 'mock') {
    await mockLatency()
    ensureMockSession(session)
    return readMockDatabase().rewards.map(normalizeReward)
  }

  const data = await callWaterAdmin<unknown>({ action: 'listRewards' }, session)
  if (Array.isArray(data)) return data.map(normalizeReward)
  const record = asRecord(data)
  const rows = record.rewards ?? record.items ?? record.rows
  return Array.isArray(rows) ? rows.map(normalizeReward) : []
}

export async function upsertWaterReward(
  session: WaterAdminSession,
  input: WaterRewardInput,
): Promise<WaterReward> {
  const reward = {
    id: input.id || undefined,
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description.trim(),
    weight: Number(input.weight),
    enabled: input.enabled,
    sortOrder: Number(input.sortOrder ?? 0),
  }

  if (!reward.code || !reward.name) {
    throw new WaterApiError('奖励编号和名称不能为空', 'INVALID_REWARD')
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(reward.code)) {
    throw new WaterApiError('奖励编号只能包含 1–64 位字母、数字、下划线或短横线', 'INVALID_REWARD_CODE')
  }
  if (reward.name.length > 120 || reward.description.length > 1000) {
    throw new WaterApiError('奖励名称或兑现说明超过长度限制', 'INVALID_REWARD_CONTENT')
  }
  if (!Number.isInteger(reward.weight) || reward.weight < 1) {
    throw new WaterApiError('抽奖权重必须是大于或等于 1 的整数；如需暂停请关闭“参与抽奖”', 'INVALID_REWARD_WEIGHT')
  }
  if (!Number.isInteger(reward.sortOrder) || reward.sortOrder < 0) {
    throw new WaterApiError('展示顺序必须是大于或等于 0 的整数', 'INVALID_REWARD_SORT_ORDER')
  }

  if (getWaterApiMode() === 'mock') {
    await mockLatency()
    ensureMockSession(session)
    const database = readMockDatabase()
    const now = new Date().toISOString()
    let index = reward.id ? database.rewards.findIndex((item) => normalizeReward(item).id === reward.id) : -1
    const codeIndex = database.rewards.findIndex(
      (item) => normalizeReward(item).code.toLowerCase() === reward.code.toLowerCase(),
    )
    if (index >= 0 && codeIndex >= 0 && codeIndex !== index) {
      throw new WaterApiError('奖励编号已被其他奖项使用', 'DUPLICATE_REWARD_CODE', 409)
    }
    // 与服务端 upsert 保持一致：新增时若编号已存在，则更新该奖项。
    if (index < 0 && codeIndex >= 0) index = codeIndex
    const existing = index >= 0 ? normalizeReward(database.rewards[index]) : null
    const next = normalizeReward({
      ...reward,
      id: existing?.id || reward.id || `reward-${randomToken().slice(0, 8)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    })

    if (index >= 0) database.rewards[index] = next
    else database.rewards.push(next)
    saveMockDatabase(database)
    return next
  }

  const data = await callWaterAdmin<unknown>(
    {
      action: 'upsertReward',
      reward: { ...reward, rewardKey: reward.code.toLowerCase() },
      ...reward,
      rewardKey: reward.code.toLowerCase(),
    },
    session,
  )
  const record = asRecord(data)
  return normalizeReward(record.reward ?? record.item ?? data)
}

async function callWaterAdmin<T>(body: UnknownRecord, session: WaterAdminSession | null): Promise<T> {
  const config = getConfig()
  if (!config.endpoint || !config.publishableKey) {
    throw new WaterApiError(
      '缺少 VITE_WATER_SUPABASE_URL 或 VITE_WATER_SUPABASE_PUBLISHABLE_KEY',
      'WATER_API_NOT_CONFIGURED',
    )
  }

  let response: Response
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: config.publishableKey,
    }
    if (session?.token) headers.Authorization = `Bearer ${session.token}`

    response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new WaterApiError(
      error instanceof Error ? `无法连接喝水奖励服务：${error.message}` : '无法连接喝水奖励服务',
      'NETWORK_ERROR',
    )
  }

  let payload: ApiEnvelope<T> | T | null = null
  try {
    payload = (await response.json()) as ApiEnvelope<T> | T
  } catch {
    // The status-specific error below is more useful than a JSON parse error.
  }

  const envelope = asRecord(payload) as ApiEnvelope<T>
  const errorPayload = envelope.error
  if (!response.ok || envelope.ok === false) {
    if (response.status === 401 || response.status === 403) clearWaterAdminSession()
    const normalizedError = typeof errorPayload === 'string' ? { message: errorPayload } : errorPayload
    throw new WaterApiError(
      normalizedError?.message || httpErrorMessage(response.status),
      normalizedError?.code || `HTTP_${response.status}`,
      response.status,
    )
  }

  return (envelope.data === undefined ? payload : envelope.data) as T
}

function normalizeCouponPage(data: unknown): WaterCouponPage {
  if (Array.isArray(data)) {
    const coupons = data.map(normalizeCoupon)
    return { coupons, total: coupons.length, stats: calculateStats(coupons) }
  }

  const record = asRecord(data)
  const pagination = asRecord(record.pagination)
  const rawRows = record.coupons ?? record.items ?? record.rows ?? []
  const coupons = Array.isArray(rawRows) ? rawRows.map(normalizeCoupon) : []
  const total = numberValue(record.total ?? record.count ?? pagination.total, coupons.length)
  const rawStats = asRecord(record.stats ?? record.summary)
  const fallbackStats = calculateStats(coupons)

  return {
    coupons,
    total,
    stats: {
      total: numberValue(rawStats.total, total || fallbackStats.total),
      issued: numberValue(rawStats.issued ?? rawStats.available ?? rawStats.active, fallbackStats.issued),
      requested: numberValue(
        rawStats.requested ?? rawStats.redemption_requested ?? rawStats.pending,
        fallbackStats.requested,
      ),
      redeemed: numberValue(rawStats.redeemed ?? rawStats.completed, fallbackStats.redeemed),
      redeemedAmount: numberValue(
        rawStats.redeemedAmount
          ?? rawStats.redeemed_amount
          ?? record.redeemedAmount
          ?? record.redeemed_amount,
        fallbackStats.redeemedAmount,
      ),
    },
  }
}

function normalizeCoupon(value: unknown): WaterCoupon {
  const record = asRecord(value)
  const reward = asRecord(record.reward ?? record.prize)
  return {
    id: stringValue(record.id ?? record.couponId ?? record.coupon_id) || 'unknown-coupon',
    code: stringValue(record.code ?? record.couponCode ?? record.coupon_code ?? record.uniqueCode ?? record.unique_code),
    lookupKey: stringValue(
      record.lookupKey ?? record.lookup_key ?? record.adminKey ?? record.admin_key ?? record.verificationKey ?? record.key,
    ),
    rewardId: nullableString(record.rewardId ?? record.reward_id ?? reward.id),
    rewardCode: nullableString(
      record.rewardCode ?? record.reward_code ?? record.rewardKey ?? record.reward_key ?? reward.code ?? reward.rewardKey,
    ),
    rewardName: stringValue(
      record.rewardName ?? record.reward_name ?? record.prizeName ?? record.prize_name ?? reward.name ?? reward.title,
    ) || '未命名奖励',
    rewardDescription: stringValue(
      record.rewardDescription ?? record.reward_description ?? record.description ?? reward.description,
    ),
    status: normalizeCouponStatus(record.status ?? record.redemptionStatus ?? record.redemption_status),
    createdAt: stringValue(record.createdAt ?? record.created_at ?? record.issuedAt ?? record.issued_at),
    requestedAt: nullableString(
      record.requestedAt ?? record.requested_at ?? record.redemptionRequestedAt ?? record.redemption_requested_at,
    ),
    redeemedAt: nullableString(record.redeemedAt ?? record.redeemed_at ?? record.completedAt ?? record.completed_at),
    requestId: nullableString(record.requestId ?? record.request_id ?? record.redemptionRequestId ?? record.redemption_request_id),
  }
}

function normalizeReward(value: unknown): WaterReward {
  const record = asRecord(value)
  return {
    id: stringValue(record.id ?? record.rewardId ?? record.reward_id) || 'unknown-reward',
    code: stringValue(record.code ?? record.rewardCode ?? record.reward_code ?? record.rewardKey ?? record.reward_key ?? record.key),
    name: stringValue(record.name ?? record.title ?? record.rewardName ?? record.reward_name) || '未命名奖励',
    description: stringValue(record.description ?? record.rewardDescription ?? record.reward_description),
    weight: numberValue(record.weight ?? record.probabilityWeight ?? record.probability_weight ?? record.probability, 0),
    enabled: booleanValue(record.enabled ?? record.isActive ?? record.is_active, true),
    sortOrder: numberValue(record.sortOrder ?? record.sort_order, 0),
    createdAt: nullableString(record.createdAt ?? record.created_at),
    updatedAt: nullableString(record.updatedAt ?? record.updated_at),
  }
}

function normalizeCouponStatus(value: unknown): WaterCouponStatus {
  const status = stringValue(value).toLowerCase()
  if (['redemption_requested', 'requested', 'pending', 'claim_requested'].includes(status)) {
    return 'redemption_requested'
  }
  if (['redeemed', 'completed', 'used', 'fulfilled'].includes(status)) return 'redeemed'
  return 'issued'
}

function calculateStats(coupons: WaterCoupon[]): WaterCouponStats {
  return coupons.reduce<WaterCouponStats>(
    (stats, coupon) => {
      stats.total += 1
      if (coupon.status === 'issued') stats.issued += 1
      if (coupon.status === 'redemption_requested') stats.requested += 1
      if (coupon.status === 'redeemed') {
        stats.redeemed += 1
        stats.redeemedAmount += FIXED_CASH_AMOUNTS[(coupon.rewardCode ?? '').trim().toLowerCase()] ?? 0
      }
      return stats
    },
    { total: 0, issued: 0, requested: 0, redeemed: 0, redeemedAmount: 0 },
  )
}

function normalizeExpiry(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Small values are conventionally a duration in seconds; large values are
    // epoch seconds or milliseconds.
    if (value < 10_000_000) return new Date(Date.now() + value * 1000).toISOString()
    return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString()
  }

  const text = stringValue(value)
  if (text && !Number.isNaN(Date.parse(text))) return new Date(text).toISOString()
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
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

function httpErrorMessage(status: number): string {
  if (status === 401) return '登录已失效，请重新登录'
  if (status === 403) return '当前账号没有后台权限'
  if (status === 404) return '喝水奖励服务尚未部署或请求的数据不存在'
  if (status >= 500) return '服务暂时不可用，请稍后再试'
  return `请求失败（${status || '未知状态'}）`
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '')
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
}

async function mockLatency(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
}

function ensureMockSession(session: WaterAdminSession): void {
  if (!session.token.startsWith('mock.') || Date.parse(session.expiresAt) <= Date.now()) {
    clearWaterAdminSession()
    throw new WaterApiError('自验会话已失效，请重新登录', 'SESSION_EXPIRED', 401)
  }
}

interface MockDatabase {
  coupons: unknown[]
  rewards: unknown[]
}

function readMockDatabase(): MockDatabase {
  if (typeof window === 'undefined') return createMockDatabase()
  try {
    const raw = window.localStorage.getItem(MOCK_DB_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as UnknownRecord
      if (Array.isArray(parsed.coupons) && Array.isArray(parsed.rewards)) {
        return { coupons: parsed.coupons, rewards: parsed.rewards }
      }
    }
  } catch {
    // Re-create demo data if the browser storage was manually corrupted.
  }
  const database = createMockDatabase()
  saveMockDatabase(database)
  return database
}

function saveMockDatabase(database: MockDatabase): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(database))
  }
}

function createMockDatabase(): MockDatabase {
  const now = Date.now()
  const isoDaysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
  const rewards: WaterReward[] = [
    {
      id: 'reward-cash-10',
      code: 'cash_10',
      name: '10元现金红包',
      description: '线下兑换10元现金红包。',
      weight: 3000,
      enabled: true,
      sortOrder: 10,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-20',
      code: 'cash_20',
      name: '20元现金红包',
      description: '线下兑换20元现金红包。',
      weight: 2500,
      enabled: true,
      sortOrder: 20,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-30',
      code: 'cash_30',
      name: '30元现金红包',
      description: '线下兑换30元现金红包。',
      weight: 1800,
      enabled: true,
      sortOrder: 30,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-50',
      code: 'cash_50',
      name: '50元现金红包',
      description: '线下兑换50元现金红包。',
      weight: 1300,
      enabled: true,
      sortOrder: 40,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-66',
      code: 'cash_66',
      name: '66元现金红包',
      description: '线下兑换66元现金红包。',
      weight: 700,
      enabled: true,
      sortOrder: 50,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-88',
      code: 'cash_88',
      name: '88元现金红包',
      description: '线下兑换88元现金红包。',
      weight: 400,
      enabled: true,
      sortOrder: 60,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-100',
      code: 'cash_100',
      name: '100元现金红包',
      description: '线下兑换100元现金红包。',
      weight: 200,
      enabled: true,
      sortOrder: 70,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-200',
      code: 'cash_200',
      name: '200元现金红包',
      description: '线下兑换200元现金红包。',
      weight: 70,
      enabled: true,
      sortOrder: 80,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-cash-520',
      code: 'cash_520',
      name: '520元现金红包',
      description: '线下兑换520元现金红包。',
      weight: 29,
      enabled: true,
      sortOrder: 90,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: 'reward-super-mystery',
      code: 'super_mystery',
      name: '超级神秘大奖',
      description: '线下兑换超级神秘大奖。',
      weight: 1,
      enabled: true,
      sortOrder: 100,
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(2),
    },
  ]

  const coupons: WaterCoupon[] = [
    mockCoupon('coupon-1', 'H2O-7M4K-9Q2F', 'LOVE-8A3P', rewards[0], 'redemption_requested', isoDaysAgo(4), isoDaysAgo(1)),
    mockCoupon('coupon-2', 'H2O-2R8N-6W5C', 'LOVE-4J9T', rewards[1], 'issued', isoDaysAgo(2)),
    mockCoupon('coupon-3', 'H2O-5X7D-3B8L', 'LOVE-6K2M', rewards[0], 'redeemed', isoDaysAgo(9), isoDaysAgo(6), isoDaysAgo(5)),
    mockCoupon('coupon-4', 'H2O-9P3V-1H6S', 'LOVE-1F7Q', rewards[2], 'issued', isoDaysAgo(1)),
    mockCoupon('coupon-5', 'H2O-4A6E-8T2Y', 'LOVE-5C8N', rewards[3], 'redemption_requested', isoDaysAgo(7), isoDaysAgo(2)),
    mockCoupon('coupon-6', 'H2O-8G1U-5K4R', 'LOVE-9W3B', rewards[0], 'issued', isoDaysAgo(0)),
  ]

  return { coupons, rewards }
}

function mockCoupon(
  id: string,
  code: string,
  lookupKey: string,
  reward: WaterReward,
  status: WaterCouponStatus,
  createdAt: string,
  requestedAt: string | null = null,
  redeemedAt: string | null = null,
): WaterCoupon {
  return {
    id,
    code,
    lookupKey,
    rewardId: reward.id,
    rewardCode: reward.code,
    rewardName: reward.name,
    rewardDescription: reward.description,
    status,
    createdAt,
    requestedAt,
    redeemedAt,
    requestId: requestedAt ? `request-${id}` : null,
  }
}

function mockListCoupons(input: ListWaterCouponsInput): WaterCouponPage {
  const allCoupons = readMockDatabase().coupons.map(normalizeCoupon)
  const query = input.query?.trim().toLowerCase() || ''
  const status = input.status && input.status !== 'all' ? input.status : null
  const filtered = allCoupons.filter((coupon) => {
    if (status && coupon.status !== status) return false
    if (!query) return true
    return [
      coupon.id,
      coupon.code,
      coupon.lookupKey,
      coupon.rewardCode,
      coupon.rewardName,
      coupon.requestId,
    ].some((value) => value?.toLowerCase().includes(query))
  })
  const offset = Math.max(0, input.offset ?? 0)
  const limit = Math.max(1, input.limit ?? 50)

  return {
    coupons: filtered.slice(offset, offset + limit),
    total: filtered.length,
    stats: calculateStats(allCoupons),
  }
}
