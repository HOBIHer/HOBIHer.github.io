import { FormEvent, useState } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/authStore'

export function LoginPage() {
  const { signIn, signUp, loading, error } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    try {
      if (mode === 'login') {
        await signIn(username, password)
      } else {
        await signUp(username, password)
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '操作失败')
    }
  }

  return (
    <main className="login-page">
      <section className="auth-panel">
        <div className="brand-mark">斗</div>
        <h1>斗气挂机修炼</h1>
        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            登录
          </button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            注册
          </button>
        </div>
        {!supabase ? <div className="notice notice--danger">缺少 Supabase 环境变量</div> : null}
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <label>
            用户名
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            密码
            <input
              value={password}
              type="password"
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <button className="primary-button" disabled={loading || !supabase}>
            {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        {localError || error ? <div className="notice notice--danger">{localError ?? error}</div> : null}
      </section>
    </main>
  )
}
