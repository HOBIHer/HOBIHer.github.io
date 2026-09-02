import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CultivationPage } from './pages/CultivationPage'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { WorldCupGuessSaintPage } from './pages/WorldCupGuessSaintPage'
import { BeautyHallPage } from './pages/BeautyHallPage'
import { MethodsSkillsPage } from './pages/MethodsSkillsPage'
import { ChoresPage } from './pages/ChoresPage'
import { AuctionPage } from './pages/AuctionPage'
import { BattlePage } from './pages/BattlePage'
import { AdminPage } from './pages/AdminPage'
import { WaterAdminPage } from './pages/WaterAdminPage'
import { WaterUserPage } from './pages/WaterUserPage'
import { AuthProvider, useAuth } from './store/authStore'
import { GameProvider } from './store/gameStore'

const TarotTablePage = lazy(() =>
  import('./pages/TarotTablePage').then((module) => ({ default: module.TarotTablePage })),
)

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

function DoupoAppRoute() {
  return (
    <AuthProvider>
      <DoupoApp />
    </AuthProvider>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/guess-saint" element={<WorldCupGuessSaintPage />} />
        <Route path="/guess-saint/:userId" element={<WorldCupGuessSaintPage />} />
        <Route path="/beauty-hall" element={<BeautyHallPage />} />
        <Route path="/water" element={<WaterUserPage />} />
        <Route path="/water-admin" element={<WaterAdminPage />} />
        <Route
          path="/tarot"
          element={
            <Suspense
              fallback={
                <main className="login-page">
                  <div className="notice">正在点亮牌桌...</div>
                </main>
              }
            >
              <TarotTablePage />
            </Suspense>
          }
        />
        <Route path="/doupo" element={<DoupoAppRoute />}>
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
  )
}
