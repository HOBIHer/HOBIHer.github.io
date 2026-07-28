import {
  calculateDailyWaterApplication,
  calculateRedeemedAmount,
  constantTimeEqual,
  corsHeaders,
  createAdminToken,
  deriveDeviceToken,
  errorResponse,
  fail,
  fixedCashAmountForRewardKey,
  normalizeCouponStatus,
  normalizeWaterAmount,
  parseKeyDictionary,
  selectWeightedIndex,
  verifyAdminToken,
  WaterApiError,
} from "./water.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("weighted picker honors cumulative boundaries", () => {
  assertEquals(selectWeightedIndex([20, 30, 50], 0), 0);
  assertEquals(selectWeightedIndex([20, 30, 50], 0.199999), 0);
  assertEquals(selectWeightedIndex([20, 30, 50], 0.2), 1);
  assertEquals(selectWeightedIndex([20, 30, 50], 0.5), 2);
  assertEquals(selectWeightedIndex([20, 30, 50], 0.999999), 2);
});

Deno.test("coupon status aliases normalize to database values", () => {
  assertEquals(normalizeCouponStatus("available"), "issued");
  assertEquals(normalizeCouponStatus("requested"), "redemption_requested");
  assertEquals(normalizeCouponStatus("all"), null);
});

Deno.test("browser form water amounts normalize without widening choices", () => {
  assertEquals(normalizeWaterAmount(20), 20);
  assertEquals(normalizeWaterAmount("250"), 250);

  let rejected = false;
  try {
    normalizeWaterAmount("250ml");
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
});

Deno.test("daily two-bottle limit partially applies the final request", () => {
  const normal = calculateDailyWaterApplication(1_500, 250);
  assertEquals(normal.requestedAmountMl, 250);
  assertEquals(normal.appliedAmountMl, 250);
  assertEquals(normal.remainingDailyMl, 250);
  assertEquals(normal.dailyLimitReached, false);

  const partial = calculateDailyWaterApplication(1_990, 250);
  assertEquals(partial.requestedAmountMl, 250);
  assertEquals(partial.appliedAmountMl, 10);
  assertEquals(partial.remainingDailyMl, 0);
  assertEquals(partial.dailyLimitReached, true);
});

Deno.test("daily two-bottle limit rejects further additions", () => {
  for (const dailyTotalMl of [2_000, 2_250]) {
    let caught: unknown;
    try {
      calculateDailyWaterApplication(dailyTotalMl, 20);
    } catch (error) {
      caught = error;
    }
    assertEquals(caught instanceof WaterApiError, true);
    assertEquals(
      (caught as WaterApiError).code,
      "WATER_DAILY_BOTTLE_LIMIT_REACHED",
    );
    assertEquals((caught as WaterApiError).status, 409);
  }
});

Deno.test("database daily-limit errors map to a structured conflict", async () => {
  const response = fail(
    new Error("P0001: WATER_DAILY_BOTTLE_LIMIT_REACHED"),
  );
  const body = await response.json();
  assertEquals(response.status, 409);
  assertEquals(body.error.code, "WATER_DAILY_BOTTLE_LIMIT_REACHED");
  assertEquals(body.code, "WATER_DAILY_BOTTLE_LIMIT_REACHED");
});

Deno.test("fixed cash reward snapshots map to yuan amounts", () => {
  const expected: Record<string, number> = {
    cash_10: 10,
    cash_20: 20,
    cash_30: 30,
    cash_50: 50,
    cash_66: 66,
    cash_88: 88,
    cash_100: 100,
    cash_200: 200,
    cash_520: 520,
  };
  for (const [rewardKey, amount] of Object.entries(expected)) {
    assertEquals(fixedCashAmountForRewardKey(rewardKey), amount);
  }
  assertEquals(fixedCashAmountForRewardKey("super_mystery"), 0);
  assertEquals(fixedCashAmountForRewardKey("sweet_words"), 0);
  assertEquals(fixedCashAmountForRewardKey("cash_999"), 0);
});

Deno.test("redeemed amount counts only redeemed fixed cash coupons", () => {
  assertEquals(
    calculateRedeemedAmount([
      { rewardKey: "cash_10", status: "redeemed" },
      { rewardKey: "cash_20", status: "redemption_requested" },
      { rewardKey: "cash_50", status: "redeemed" },
      { rewardKey: "super_mystery", status: "redeemed" },
      { rewardKey: "sweet_words", status: "redeemed" },
    ]),
    60,
  );
});

Deno.test("named Supabase key dictionaries ignore malformed entries", () => {
  const parsed = parseKeyDictionary(
    '{"default":" sb_secret_test ","empty":"","number":42}',
  );
  assertEquals(parsed.default, "sb_secret_test");
  assertEquals(Object.keys(parsed).length, 1);
  assertEquals(Object.keys(parseKeyDictionary("not-json")).length, 0);
});

Deno.test("browser CORS contract allows Supabase and device headers", () => {
  const allowed = corsHeaders["Access-Control-Allow-Headers"].toLowerCase();
  for (
    const header of [
      "authorization",
      "apikey",
      "content-type",
      "x-client-info",
      "x-retry-count",
      "x-water-device-id",
      "x-water-device-token",
    ]
  ) {
    assertEquals(allowed.split(/,\s*/u).includes(header), true);
  }
  assertEquals(corsHeaders["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

Deno.test("errors expose canonical and small-client-compatible shapes", async () => {
  const response = errorResponse("TEST_ERROR", "test message", 409);
  const body = await response.json();
  assertEquals(response.status, 409);
  assertEquals(body.ok, false);
  assertEquals(body.error.code, "TEST_ERROR");
  assertEquals(body.error.message, "test message");
  assertEquals(body.code, "TEST_ERROR");
  assertEquals(body.message, "test message");
});

Deno.test("constant-time comparator returns correct result", () => {
  assertEquals(constantTimeEqual("admin", "admin"), true);
  assertEquals(constantTimeEqual("admin", "wrong"), false);
  assertEquals(constantTimeEqual("short", "shorter"), false);
});

Deno.test("device token derivation is deterministic per registration request", async () => {
  const requestId = "019fa669-b75a-73e2-a31c-603ecf54ffba";
  const first = await deriveDeviceToken(requestId, "test-only-secret");
  const retry = await deriveDeviceToken(requestId, "test-only-secret");
  const different = await deriveDeviceToken(
    "019fa669-b75a-73e2-a31c-603ecf54ffbb",
    "test-only-secret",
  );
  assertEquals(first, retry);
  assertEquals(first === different, false);
});

Deno.test("admin session token verifies and then expires", async () => {
  const session = await createAdminToken("test-only-secret", 1_000, 60);
  await verifyAdminToken(session.token, "test-only-secret", 1_030);

  let rejected = false;
  try {
    await verifyAdminToken(session.token, "test-only-secret", 1_061);
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
});
