import { createClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from './env'

const env = readSupabaseEnv()

export const supabase = env
  ? createClient(env.url, env.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('缺少 Supabase 环境变量')
  }
  return supabase
}
