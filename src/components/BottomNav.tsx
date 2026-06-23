import { Dumbbell, Gavel, Hammer, ScrollText, Swords } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: '修炼', icon: Dumbbell },
  { to: '/methods', label: '功法', icon: ScrollText },
  { to: '/chores', label: '杂工', icon: Hammer },
  { to: '/auction', label: '拍卖', icon: Gavel },
  { to: '/battle', label: '对战', icon: Swords },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="bottom-nav__item" title={label}>
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
