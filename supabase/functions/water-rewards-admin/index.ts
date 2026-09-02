// Supabase Edge Functions resolve npm specifiers during deployment.
// deno-lint-ignore no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bearerToken,
  constantTimeEqual,
  corsHeaders,
  createAdminToken,
  errorResponse,
  fail,
  normalizeCouponStatus,
  ok,
  optionalString,
  readJsonObject,
  readSupabaseServerKey,
  requirePublishableKey,
  requireString,
  requireUuid,
  verifyAdminToken,
  WaterApiError,
} from "../_shared/water.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = readSupabaseServerKey();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL or a Supabase server key is not configured");
}

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "water-rewards-admin/1.0" } },
  })
  : null;

async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!supabase) {
    throw new WaterApiError(
      "SERVER_NOT_CONFIGURED",
      "服务暂时不可用，请稍后重试。",
      503,
    );
  }
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new WaterApiError(
      "INVALID_ARGUMENT",
      `${field} 必须是 ${minimum} 到 ${maximum} 之间的整数。`,
      400,
    );
  }
  return parsed;
}

function booleanValue(
  value: unknown,
  fallback: boolean,
  field = "enabled",
): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw new WaterApiError(
      "INVALID_ARGUMENT",
      `${field} 必须是布尔值。`,
      400,
    );
  }
  return value;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return errorResponse(
      "METHOD_NOT_ALLOWED",
      "仅支持 POST。",
      405,
    );
  }

  try {
    requirePublishableKey(request);
    if (!supabase) {
      throw new WaterApiError(
        "SERVER_NOT_CONFIGURED",
        "服务暂时不可用，请稍后重试。",
        503,
      );
    }
    const body = await readJsonObject(request);
    const action = requireString(body.action, "action", 64);
    const sessionSecret = Deno.env.get("WATER_ADMIN_SESSION_SECRET") ||
      serviceRoleKey;

    if (action === "login") {
      const username = requireString(body.username, "username", 100);
      const password = requireString(body.password, "password", 200);
      // admin/admin is intentionally the demo default requested for this phase.
      // Production deployments should override both environment variables.
      const expectedUsername = Deno.env.get("WATER_ADMIN_USERNAME") || "admin";
      const expectedPassword = Deno.env.get("WATER_ADMIN_PASSWORD") || "admin";
      const usernameMatches = constantTimeEqual(username, expectedUsername);
      const passwordMatches = constantTimeEqual(password, expectedPassword);
      if (!(usernameMatches && passwordMatches)) {
        throw new WaterApiError(
          "INVALID_ADMIN_CREDENTIALS",
          "用户名或密码错误。",
          401,
        );
      }
      return ok(await createAdminToken(sessionSecret));
    }

    await verifyAdminToken(bearerToken(request), sessionSecret);

    switch (action) {
      case "listCoupons": {
        const result = await rpc("water_admin_list_coupons", {
          p_status: normalizeCouponStatus(body.status),
          p_query: optionalString(
            body.query ?? body.key ?? body.code,
            "query",
            100,
          ),
          p_limit: boundedInteger(body.limit, 50, 1, 200, "limit"),
          p_offset: boundedInteger(body.offset, 0, 0, 1000000, "offset"),
        });
        return ok(result);
      }

      case "getCoupon": {
        const lookup = requireString(
          body.lookup ?? body.lookupKey ?? body.couponCode ?? body.code ??
            body.key ?? body.query ?? body.id,
          "lookup",
          100,
        );
        return ok(await rpc("water_admin_get_coupon", { p_lookup: lookup }));
      }

      case "markRedeemed": {
        const lookup = requireString(
          body.lookup ?? body.lookupKey ?? body.couponCode ?? body.code ??
            body.key ?? body.query ?? body.id,
          "lookup",
          100,
        );
        const requestId = requireUuid(
          body.requestId ?? body.request_id,
          "requestId",
        );
        return ok(
          await rpc("water_admin_mark_redeemed", {
            p_lookup: lookup,
            p_request_id: requestId,
          }),
        );
      }

      case "listRewards":
        return ok(await rpc("water_admin_list_rewards"));

      case "getSettings":
        return ok(await rpc("water_admin_get_settings"));

      case "updateSettings": {
        const nested = body.settings && typeof body.settings === "object" &&
            !Array.isArray(body.settings)
          ? body.settings as Record<string, unknown>
          : body;
        const tarotPromoEnabled = booleanValue(
          nested.tarotPromoEnabled ?? nested.tarot_promo_enabled,
          true,
          "tarotPromoEnabled",
        );
        return ok(
          await rpc("water_admin_update_settings", {
            p_tarot_promo_enabled: tarotPromoEnabled,
          }),
        );
      }

      case "upsertReward": {
        const nested = body.reward && typeof body.reward === "object" &&
            !Array.isArray(body.reward)
          ? body.reward as Record<string, unknown>
          : body;
        const rewardId = optionalString(nested.id, "id", 64);
        const rewardKey = requireString(
          nested.rewardKey ?? nested.code ?? nested.key,
          "rewardKey",
          64,
        ).toLowerCase();
        const name = requireString(nested.name, "name", 120);
        const description = optionalString(
          nested.description,
          "description",
          1000,
        ) ?? "";
        const result = await rpc("water_admin_upsert_reward", {
          p_reward_id: rewardId ? requireUuid(rewardId, "id") : null,
          p_reward_key: rewardKey,
          p_name: name,
          p_description: description,
          p_weight: boundedInteger(nested.weight, 1, 0, 1000000, "weight"),
          p_enabled: booleanValue(nested.enabled, true),
          p_sort_order: boundedInteger(
            nested.sortOrder,
            0,
            -1000000,
            1000000,
            "sortOrder",
          ),
        });
        return ok(result);
      }

      default:
        throw new WaterApiError("UNKNOWN_ACTION", "未知操作。", 400);
    }
  } catch (error) {
    return fail(error);
  }
});
