import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const envPath = resolve(root, '.env.local')

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const [key, ...rest] = line.split('=')
    if (key && rest.length > 0 && !process.env[key]) {
      process.env[key] = rest.join('=').trim()
    }
  }
}

function ok(message) {
  console.log(`OK ${message}`)
}

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const shouldRegister = process.argv.includes('--register')

  if (!supabaseUrl || !supabaseKey) {
    fail('Missing Supabase URL or publishable key')
    return
  }

  ok('Supabase environment variables are present')

  if (!shouldRegister) {
    console.log('Run `npm run smoke:supabase -- --register` to create a disposable test user and verify Auth/RPC.')
    return
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const suffix = Date.now().toString(36)
  const username = `codex_smoke_${suffix}`
  const email = `${username.replace(/_/g, '-')}@douqi.example.com`
  const password = `Smoke-${suffix}-Aa1!`

  const signUp = await client.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })

  if (signUp.error) {
    fail(`signUp failed: ${signUp.error.message}`)
    return
  }
  ok(`registered ${username}`)

  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) {
    fail(`signIn failed: ${signIn.error.message}`)
    return
  }
  ok('signed in with username-derived fake email')

  const profileResult = await client.from('player_profiles').select('*').eq('username', username).single()
  if (profileResult.error || !profileResult.data) {
    fail(`profile read failed: ${profileResult.error?.message ?? 'no profile'}`)
    return
  }
  ok('profile exists')

  const basicAttack = await client
    .from('game_items')
    .select('id,name,is_basic,skill_kind')
    .eq('owner_id', profileResult.data.id)
    .eq('is_basic', true)
    .single()

  if (basicAttack.error || basicAttack.data?.skill_kind !== 'normal_attack') {
    fail(`basic attack missing: ${basicAttack.error?.message ?? 'wrong skill'}`)
    return
  }
  ok('basic attack exists')

  const levels = await client.from('level_configs').select('level_order', { count: 'exact', head: true })
  if (levels.error || levels.count !== 108) {
    fail(`level_configs count is not 108: ${levels.error?.message ?? levels.count}`)
    return
  }
  ok('level_configs contains 108 rows')

  const firstSettle = await client.rpc('settle_self')
  if (firstSettle.error) {
    fail(`settle_self failed: ${firstSettle.error.message}`)
    return
  }
  ok('settle_self RPC works')

  const start = await client.rpc('start_activity', {
    p_activity: 'cultivating',
    p_target_id: null,
    p_payload: {},
  })
  if (start.error) {
    fail(`start_activity cultivating failed: ${start.error.message}`)
    return
  }
  ok('start_activity cultivating works')

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2200))

  const secondSettle = await client.rpc('settle_self')
  if (secondSettle.error) {
    fail(`second settle failed: ${secondSettle.error.message}`)
    return
  }

  const xp = Number(secondSettle.data?.cultivation_xp ?? 0)
  if (!(xp > Number(profileResult.data.cultivation_xp ?? 0))) {
    fail(`cultivation XP did not increase; current xp ${xp}`)
    return
  }
  ok('cultivation increases over real elapsed time')

  await client.rpc('start_activity', {
    p_activity: 'idle',
    p_target_id: null,
    p_payload: {},
  })
  ok('returned smoke account to idle')
}

await main()
