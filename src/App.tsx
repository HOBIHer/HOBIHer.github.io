import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CultivationPage } from './pages/CultivationPage'
import { LoginPage } from './pages/LoginPage'
import { MethodsSkillsPage } from './pages/MethodsSkillsPage'
import { ChoresPage } from './pages/ChoresPage'
import { AuctionPage } from './pages/AuctionPage'
import { BattlePage } from './pages/BattlePage'
import { AdminPage } from './pages/AdminPage'
import { AuthProvider, useAuth } from './store/authStore'
import { GameProvider } from './store/gameStore'

function AuthedApp() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main className="login-page">
        <div className="notice">加载中...</div>
      </main>
    )
  }

  if (!session) return <LoginPage />

  return (
    <GameProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<CultivationPage />} />
          <Route path="/methods" element={<MethodsSkillsPage />} />
          <Route path="/chores" element={<ChoresPage />} />
          <Route path="/auction" element={<AuctionPage />} />
          <Route path="/battle" element={<BattlePage />} />
          <Route path="/admin-stone-gate" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </GameProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AuthedApp />
      </HashRouter>
    </AuthProvider>
  )
}
