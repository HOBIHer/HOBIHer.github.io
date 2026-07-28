import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { WaterAdminPage } from '../pages/WaterAdminPage'

describe('WaterAdminPage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() })
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

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
