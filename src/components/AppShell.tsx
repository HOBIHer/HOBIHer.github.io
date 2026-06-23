import { LogOut, RefreshCw, Shield } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { activityLabel } from '../game/labels'
import { useAuth } from '../store/authStore'
import { useGame } from '../store/gameStore'
import { BottomNav } from './BottomNav'

export function AppShell() {
  const { signOut } = useAuth()
  const { profile, loading, error, refreshAll } = useGame()

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <span className="eyebrow">斗气挂机</span>
          <h1>{profile?.display_name ?? profile?.username ?? '修炼者'}</h1>
        </div>
        <div className="topbar__actions">
          {profile?.is_admin ? (
            <Link className="icon-button" to="/admin-stone-gate" title="后台">
              <Shield size={18} />
            </Link>
          ) : null}
          <button className="icon-button" onClick={() => void refreshAll()} title="刷新">
            <RefreshCw size={18} />
          </button>
          <button className="icon-button" onClick={() => void signOut()} title="登出">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="screen">
        {loading ? <div className="notice">加载中...</div> : null}
        {error ? <div className="notice notice--danger">{error}</div> : null}
        {profile ? (
          <div className="status-strip">
            <span>灵石 {profile.coins}</span>
            <span>{activityLabel(profile.activity_type)}</span>
          </div>
        ) : null}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
