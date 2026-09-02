import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaterAdminPage } from '../pages/WaterAdminPage'

describe('WaterAdminPage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() })
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.stubEnv('VITE_WATER_ADMIN_MOCK', 'true')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows the redeemed amount and uses scratch-card terminology after login', async () => {
    const { container } = render(
      <MemoryRouter>
        <WaterAdminPage />
      </MemoryRouter>,
    )
    const form = container.querySelector('form')!
    const username = form.elements.namedItem('username') as HTMLInputElement
    const password = form.elements.namedItem('password') as HTMLInputElement

    fireEvent.change(username, { target: { value: 'admin' } })
    fireEvent.change(password, { target: { value: 'admin' } })
    fireEvent.submit(form)

    expect(await screen.findByText('已兑换金额')).toBeInTheDocument()
    expect(await screen.findByText('10元')).toBeInTheDocument()
    expect(screen.getByText('刮刮乐与兑换')).toBeInTheDocument()
    expect(screen.getByText('全部刮刮乐')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '刮刮乐台账' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/卡券|奖券/)
  })

  it('saves a clear tarot promotion visibility switch', async () => {
    const { container } = render(
      <MemoryRouter>
        <WaterAdminPage />
      </MemoryRouter>,
    )
    const loginForm = container.querySelector('form')!
    fireEvent.change(loginForm.elements.namedItem('username') as HTMLInputElement, {
      target: { value: 'admin' },
    })
    fireEvent.change(loginForm.elements.namedItem('password') as HTMLInputElement, {
      target: { value: 'admin' },
    })
    fireEvent.submit(loginForm)

    fireEvent.click(await screen.findByRole('button', { name: '前台展示' }))
    const toggle = await screen.findByRole('checkbox', { name: /宣传画上线开关/ })
    expect(toggle).toBeChecked()

    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: '保存展示设置' }))

    expect(await screen.findByText('占卜宣传画已下线')).toBeInTheDocument()
    expect(toggle).not.toBeChecked()
    const database = JSON.parse(window.localStorage.getItem('water-admin-mock-db-v2')!)
    expect(database.settings.tarotPromoEnabled).toBe(false)
  })
})

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}
