export const WATER_AMOUNTS_ML = [20, 250] as const;
export const BOTTLE_CAPACITY_ML = 1000;
export const DAILY_BOTTLE_LIMIT = 2;
export const DAILY_WATER_LIMIT_ML = BOTTLE_CAPACITY_ML * DAILY_BOTTLE_LIMIT;
export const FIXED_CASH_AMOUNTS: Readonly<Record<string, number>> = Object
  .freeze({
    cash_10: 10,
    cash_20: 20,
    cash_30: 30,
    cash_50: 50,
    cash_66: 66,
    cash_88: 88,
    cash_100: 100,
    cash_200: 200,
    cash_520: 520,
  });
export const COUPON_STATUSES = [
  "issued",
  "redemption_requested",
  "redeemed",
] as const;

export class WaterApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "WaterApiError";
  }
}

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-retry-count, x-water-device-id, x-water-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function ok(data: unknown, status = 200): Response {
  return jsonResponse({ ok: true, data }, status);
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  return jsonResponse(
    {
      ok: false,
      error: { code, message },
      // Top-level aliases keep the endpoint friendly to small fetch wrappers
      // while `error` remains the canonical structured representation.
      code,
      message,
    },
    status,
  );
}

export function fail(error: unknown): Response {
  const normalized = normalizeError(error);
  return errorResponse(
    normalized.code,
    normalized.message,
    normalized.status,
  );
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new WaterApiError("INVALID_JSON", "请求体必须是有效的 JSON。", 400);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WaterApiError("INVALID_BODY", "请求体必须是 JSON 对象。", 400);
  }
  return value as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  field: string,
  maxLength = 512,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new WaterApiError(
      "INVALID_ARGUMENT",
      `${field} 必须是非空字符串。`,
      400,
    );
  }
  const result = value.trim();
  if (result.length > maxLength) {
    throw new WaterApiError(
      "INVALID_ARGUMENT",
      `${field} 长度超出限制。`,
      400,
    );
  }
  return result;
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength = 512,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, field, maxLength);
}

export function requireUuid(value: unknown, field: string): string {
  const text = requireString(value, field, 64).toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(
        text,
      )
  ) {
    throw new WaterApiError(
      "INVALID_ARGUMENT",
      `${field} 必须是 UUID。`,
      400,
    );
  }
  return text;
}

export function normalizeCouponStatus(value: unknown): string | null {
  if (
    value === undefined || value === null || value === "" || value === "all"
  ) {
    return null;
  }
  const aliases: Record<string, string> = {
    available: "issued",
    requested: "redemption_requested",
    redeem_requested: "redemption_requested",
  };
  const normalized = aliases[String(value)] ?? String(value);
  if (!(COUPON_STATUSES as readonly string[]).includes(normalized)) {
    throw new WaterApiError(
      "INVALID_COUPON_STATUS",
      "未知的卡券状态。",
      400,
    );
  }
  return normalized;
}

export function normalizeWaterAmount(value: unknown): 20 | 250 {
  const parsed = typeof value === "string" && /^(20|250)$/u.test(value.trim())
    ? Number(value.trim())
    : value;
  if (
    typeof parsed !== "number" ||
    !Number.isInteger(parsed) ||
    !(WATER_AMOUNTS_ML as readonly number[]).includes(parsed)
  ) {
    throw new WaterApiError(
      "INVALID_AMOUNT",
      "每次只能加入 20ml 或 250ml。",
      400,
    );
  }
  return parsed as 20 | 250;
}

/** Mirrors the authoritative transaction rule in public.water_add_water. */
export function calculateDailyWaterApplication(
  dailyTotalMl: number,
  requestedAmount: unknown,
): {
  requestedAmountMl: 20 | 250;
  appliedAmountMl: number;
  remainingDailyMl: number;
  dailyLimitReached: boolean;
} {
  if (
    !Number.isSafeInteger(dailyTotalMl) ||
    dailyTotalMl < 0
  ) {
    throw new Error("dailyTotalMl must be a non-negative safe integer");
  }
  const requestedAmountMl = normalizeWaterAmount(requestedAmount);
  if (dailyTotalMl >= DAILY_WATER_LIMIT_ML) {
    throw new WaterApiError(
      "WATER_DAILY_BOTTLE_LIMIT_REACHED",
      "今天已经喝满两瓶啦，明天再继续。",
      409,
    );
  }

  const appliedAmountMl = Math.min(
    requestedAmountMl,
    DAILY_WATER_LIMIT_ML - dailyTotalMl,
  );
  const remainingDailyMl = DAILY_WATER_LIMIT_ML - dailyTotalMl -
    appliedAmountMl;
  return {
    requestedAmountMl,
    appliedAmountMl,
    remainingDailyMl,
    dailyLimitReached: remainingDailyMl === 0,
  };
}

export function fixedCashAmountForRewardKey(rewardKey: unknown): number {
  return typeof rewardKey === "string" ? FIXED_CASH_AMOUNTS[rewardKey] ?? 0 : 0;
}

export function calculateRedeemedAmount(
  coupons: readonly { rewardKey: unknown; status: unknown }[],
): number {
  return coupons.reduce(
    (total, coupon) =>
      coupon.status === "redeemed"
        ? total + fixedCashAmountForRewardKey(coupon.rewardKey)
        : total,
    0,
  );
}

/**
 * Pure weighted-selection helper used by tests/simulations. The database uses
 * the same cumulative-weight rule inside the award transaction.
 */
export function selectWeightedIndex(
  weights: readonly number[],
  unitRandom: number,
): number {
  if (
    weights.length === 0 ||
    !weights.every((weight) => Number.isFinite(weight) && weight > 0)
  ) {
    throw new Error("weights must be a non-empty array of positive numbers");
  }
  if (!Number.isFinite(unitRandom) || unitRandom < 0 || unitRandom >= 1) {
    throw new Error("unitRandom must be in [0, 1)");
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = unitRandom * total;
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (cumulative > target) return index;
  }
  return weights.length - 1;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function requirePublishableKey(request: Request): void {
  const supplied = request.headers.get("apikey")?.trim();
  if (!supplied) {
    throw new WaterApiError(
      "MISSING_API_KEY",
      "请求缺少 apikey 请求头。",
      401,
    );
  }

  const configuredKeys = [
    Deno.env.get("WATER_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    ...readKeyDictionary("SUPABASE_PUBLISHABLE_KEYS"),
  ].filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());

  if (
    configuredKeys.length > 0 &&
    !configuredKeys.some((expected) => constantTimeEqual(supplied, expected))
  ) {
    throw new WaterApiError("INVALID_API_KEY", "apikey 无效。", 401);
  }
}

/** Supports both legacy single-key variables and the current named-key JSON. */
export function readSupabaseServerKey(): string {
  const direct = Deno.env.get("WATER_SUPABASE_SERVER_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY");
  if (direct?.trim()) return direct.trim();

  const currentKeys = parseKeyDictionary(
    Deno.env.get("SUPABASE_SECRET_KEYS"),
  );
  if (currentKeys.default) return currentKeys.default;
  const firstCurrentKey = Object.values(currentKeys)[0];
  if (firstCurrentKey) return firstCurrentKey;

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
}

function readKeyDictionary(variable: string): string[] {
  return Object.values(parseKeyDictionary(Deno.env.get(variable)));
}

export function parseKeyDictionary(
  rawValue: string | undefined,
): Record<string, string> {
  const raw = rawValue?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] =>
          typeof entry[1] === "string" && entry[1].trim().length > 0
        )
        .map(([name, value]) => [name, value.trim()]),
    );
  } catch {
    return {};
  }
}

export function getDeviceCredentials(
  request: Request,
  body: Record<string, unknown>,
): { deviceId: string; deviceToken: string } {
  const deviceId = requireUuid(
    request.headers.get("x-water-device-id") ?? body.deviceId ?? body.device_id,
    "deviceId",
  );
  const deviceToken = requireString(
    request.headers.get("x-water-device-token") ??
      body.deviceToken ??
      body.device_token,
    "deviceToken",
    512,
  );
  if (deviceToken.length < 32) {
    throw new WaterApiError(
      "INVALID_DEVICE_CREDENTIALS",
      "设备凭据无效。",
      401,
    );
  }
  return { deviceId, deviceToken };
}

function normalizeError(error: unknown): WaterApiError {
  if (error instanceof WaterApiError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const known: Array<[string, string, number]> = [
    ["WATER_INVALID_DEVICE_CREDENTIALS", "设备凭据无效或已停用。", 401],
    ["WATER_INVALID_DEVICE_TOKEN", "设备凭据无效。", 401],
    ["WATER_INVALID_REQUEST_ID", "requestId 无效。", 400],
    ["WATER_INVALID_AMOUNT", "每次只能加入 20ml 或 250ml。", 400],
    [
      "WATER_DAILY_BOTTLE_LIMIT_REACHED",
      "今天已经喝满两瓶啦，明天再继续。",
      409,
    ],
    ["WATER_IDEMPOTENCY_CONFLICT", "requestId 已被用于不同请求。", 409],
    ["WATER_COUPON_NOT_FOUND", "没有找到这张卡券。", 404],
    ["WATER_COUPON_REWARD_MISMATCH", "卡券编码与奖励内容不匹配。", 409],
    ["WATER_COUPON_ALREADY_REDEEMED", "这张卡券已经兑换完成。", 409],
    ["WATER_REDEMPTION_NOT_REQUESTED", "该卡券尚未申请兑换。", 409],
    ["WATER_REWARD_NOT_FOUND", "没有找到该奖项。", 404],
    ["WATER_REWARD_POOL_EMPTY", "奖池目前没有可用奖项。", 503],
    ["WATER_INVALID_COUPON_STATUS", "未知的卡券状态。", 400],
  ];

  for (const [code, publicMessage, status] of known) {
    if (message.includes(code)) {
      return new WaterApiError(code, publicMessage, status);
    }
  }

  console.error("water rewards internal error", error);
  return new WaterApiError(
    "INTERNAL_ERROR",
    "服务暂时不可用，请稍后重试。",
    500,
  );
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacSha256(secret: string, value: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

export async function deriveDeviceToken(
  registrationRequestId: string,
  secret: string,
): Promise<string> {
  return base64Url(
    await hmacSha256(secret, `water-device:${registrationRequestId}`),
  );
}

type AdminClaims = {
  sub: "water-admin";
  iat: number;
  exp: number;
  nonce: string;
};

export async function createAdminToken(
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 8 * 60 * 60,
): Promise<{ token: string; expiresAt: string }> {
  const claims: AdminClaims = {
    sub: "water-admin",
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    nonce: crypto.randomUUID(),
  };
  const payload = base64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = base64Url(await hmacSha256(secret, payload));
  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

export async function verifyAdminToken(
  token: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<void> {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new WaterApiError("INVALID_ADMIN_TOKEN", "后台登录已失效。", 401);
  }
  const expected = base64Url(await hmacSha256(secret, parts[0]));
  if (!constantTimeEqual(parts[1], expected)) {
    throw new WaterApiError("INVALID_ADMIN_TOKEN", "后台登录已失效。", 401);
  }

  let claims: Partial<AdminClaims>;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0])));
  } catch {
    throw new WaterApiError("INVALID_ADMIN_TOKEN", "后台登录已失效。", 401);
  }
  if (
    claims.sub !== "water-admin" ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp) ||
    (claims.iat as number) > nowSeconds + 60 ||
    (claims.exp as number) <= nowSeconds
  ) {
    throw new WaterApiError("INVALID_ADMIN_TOKEN", "后台登录已失效。", 401);
  }
}

export function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new WaterApiError("MISSING_ADMIN_TOKEN", "请先登录后台。", 401);
  }
  return match[1].trim();
}
