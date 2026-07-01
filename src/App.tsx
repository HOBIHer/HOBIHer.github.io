import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CultivationPage } from './pages/CultivationPage'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { WorldCupGuessSaintPage } from './pages/WorldCupGuessSaintPage'
import { MethodsSkillsPage } from './pages/MethodsSkillsPage'
import { ChoresPage } from './pages/ChoresPage'
import { AuctionPage } from './pages/AuctionPage'
import { BattlePage } from './pages/BattlePage'
import { AdminPage } from './pages/AdminPage'
import { AuthProvider, useAuth } from './store/authStore'
import { GameProvider } from './store/gameStore'

function DoupoApp() {
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
      <AppShell />
    </GameProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/guess-saint" element={<WorldCupGuessSaintPage />} />
          <Route path="/guess-saint/:userId" element={<WorldCupGuessSaintPage />} />
          <Route path="/doupo" element={<DoupoApp />}>
            <Route index element={<CultivationPage />} />
            <Route path="methods" element={<MethodsSkillsPage />} />
            <Route path="chores" element={<ChoresPage />} />
            <Route path="auction" element={<AuctionPage />} />
            <Route path="battle" element={<BattlePage />} />
            <Route path="admin-stone-gate" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
