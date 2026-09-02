// Supabase Edge Functions resolve npm specifiers during deployment.
// deno-lint-ignore no-import-prefix
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  deriveDeviceToken,
  errorResponse,
  fail,
  getDeviceCredentials,
  normalizeCouponStatus,
  normalizeWaterAmount,
  ok,
  optionalString,
  readJsonObject,
  readSupabaseServerKey,
  requirePublishableKey,
  requireString,
  requireUuid,
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
    global: { headers: { "X-Client-Info": "water-rewards-api/1.0" } },
  })
  : null;

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
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

    if (action === "registerDevice") {
      const requestId = requireUuid(
        body.requestId ?? body.request_id,
        "requestId",
      );
      // Derivation makes a retry with the same requestId return the same device
      // credential without storing a plaintext token in Postgres.
      const tokenSecret = Deno.env.get("WATER_DEVICE_TOKEN_SECRET") ||
        serviceRoleKey;
      const deviceToken = await deriveDeviceToken(requestId, tokenSecret);
      const state = await rpc<Record<string, unknown>>(
        "water_register_device",
        {
          p_device_token: deviceToken,
          p_request_id: requestId,
        },
      );
      return ok({ ...state, deviceToken });
    }

    if (action === "getSettings") {
      return ok(await rpc("water_get_public_settings", {}));
    }

    const { deviceId, deviceToken } = getDeviceCredentials(request, body);

    switch (action) {
      case "getState": {
        const [state, settings] = await Promise.all([
          rpc<Record<string, unknown>>("water_get_state", {
            p_device_id: deviceId,
            p_device_token: deviceToken,
          }),
          rpc<Record<string, unknown>>("water_get_public_settings", {}),
        ]);
        return ok({ ...state, ...settings });
      }

      case "addWater": {
        const amountMl = normalizeWaterAmount(body.amountMl ?? body.amount_ml);
        const requestId = requireUuid(
          body.requestId ?? body.request_id,
          "requestId",
        );
        const result = await rpc("water_add_water", {
          p_device_id: deviceId,
          p_device_token: deviceToken,
          p_amount_ml: amountMl,
          p_request_id: requestId,
        });
        return ok(result);
      }

      case "listCoupons": {
        const status = normalizeCouponStatus(body.status);
        const result = await rpc("water_list_coupons", {
          p_device_id: deviceId,
          p_device_token: deviceToken,
          p_status: status,
        });
        return ok(result);
      }

      case "requestRedeem": {
        const requestId = requireUuid(
          body.requestId ?? body.request_id,
          "requestId",
        );
        const couponCode = requireString(
          body.couponCode ?? body.code ?? body.coupon_code,
          "couponCode",
          80,
        );
        const result = await rpc("water_request_redeem", {
          p_device_id: deviceId,
          p_device_token: deviceToken,
          p_coupon_code: couponCode,
          p_request_id: requestId,
          p_reward_key: optionalString(body.rewardKey, "rewardKey", 64),
          p_reward_name: optionalString(
            body.rewardName,
            "rewardName",
            120,
          ),
          p_reward_description: optionalString(
            body.rewardDescription ?? body.rewardContent,
            "rewardDescription",
            1000,
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
