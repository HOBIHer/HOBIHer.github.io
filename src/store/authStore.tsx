import type { Session, User } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { requireSupabase, supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  error: string | null
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function usernameToEmail(username: string): string {
  return `${normalizeUsername(username).replace(/_/g, '-')}@douqi.example.com`
}

function validateUsername(username: string) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    throw new Error('用户名需为 3-20 位字母、数字或下划线')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setError(null)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    validateUsername(username)
    setLoading(true)
    setError(null)
    try {
      const client = requireSupabase()
      const { error: signInError } = await client.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      })
      if (signInError) throw signInError
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const signUp = useCallback(async (username: string, password: string) => {
    validateUsername(username)
    setLoading(true)
    setError(null)
    try {
      const client = requireSupabase()
      const normalized = normalizeUsername(username)
      const { error: signUpError } = await client.auth.signUp({
        email: usernameToEmail(normalized),
        password,
        options: {
          data: { username: normalized },
        },
      })
      if (signUpError) throw signUpError
      await client.auth.signInWithPassword({
        email: usernameToEmail(normalized),
        password,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      await requireSupabase().auth.signOut()
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      error,
      signIn,
      signUp,
      signOut,
    }),
    [error, loading, session, signIn, signOut, signUp],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
