import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TarotPlacedCard, TarotSceneSnapshot } from '../tarot/TarotScene'

const sceneMock = vi.hoisted(() => ({
  snapshot: null as TarotSceneSnapshot | null,
  listener: null as ((snapshot: TarotSceneSnapshot) => void) | null,
  preloadAssetUrls: [] as readonly string[],
  mount: vi.fn(),
  destroy: vi.fn(),
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
  spread: vi.fn(() => Promise.resolve(true)),
  repair: vi.fn(() => Promise.resolve(true)),
  collapse: vi.fn(() => Promise.resolve(true)),
  returnAllCardsToStack: vi.fn(() => Promise.resolve(true)),
  resetSpread: vi.fn(() => Promise.resolve(true)),
  setSpread: vi.fn((_spreadId: string) => true),
  revealPlacedCards: vi.fn<() => TarotPlacedCard[]>(() => []),
}))

vi.mock('../tarot/TarotScene', () => ({
  TarotScene: class MockTarotScene {
    constructor(_host: HTMLElement, options: { preloadAssetUrls?: readonly string[] } = {}) {
      sceneMock.preloadAssetUrls = options.preloadAssetUrls ?? []
    }

    mount() {
      sceneMock.mount()
      return this
    }

    destroy() {
      sceneMock.destroy()
    }

    getSnapshot() {
      if (!sceneMock.snapshot) throw new Error('Mock TarotScene snapshot is missing')
      return sceneMock.snapshot
    }

    subscribe(listener: (snapshot: TarotSceneSnapshot) => void) {
      sceneMock.subscribe(listener)
      sceneMock.listener = listener
      listener(this.getSnapshot())
      return sceneMock.unsubscribe
    }

    spread() {
      return sceneMock.spread()
    }

    repair() {
      return sceneMock.repair()
    }

    collapse() {
      return sceneMock.collapse()
    }

    returnAllCardsToStack() {
      return sceneMock.returnAllCardsToStack()
    }

    resetSpread() {
      return sceneMock.resetSpread()
    }

    setSpread(spreadId: string) {
      return sceneMock.setSpread(spreadId)
    }

    revealPlacedCards() {
      return sceneMock.revealPlacedCards()
    }
  },
}))

import { TarotTablePage } from '../pages/TarotTablePage'

const hiddenCard: TarotPlacedCard = {
  cardId: 'major-00-fool',
  deckIndex: 0,
  nameZh: '愚者',
  nameEn: 'The Fool',
  frontTextureUrl: '/assets/tarot/cards/major-00-fool.webp',
  spreadId: 'single',
  slotId: 'guidance',
  slotOrder: 1,
  slotLabelZh: '核心指引',
  slotLabelEn: 'Guidance',
  slotMeaningZh: '关键词',
  revealed: false,
}

function makeSnapshot(placedCards: readonly TarotPlacedCard[]): TarotSceneSnapshot {
  const hasHiddenCard = placedCards.some((card) => !card.revealed)
  return {
    ready: true,
    loadingProgress: 100,
    loadedAssets: 89,
    totalAssets: 89,
    error: null,
    mode: 'fan',
    spreadId: 'single',
    occupiedSlots: Object.fromEntries(placedCards.map((card) => [card.slotId, card.cardId])),
    placedCards,
    draggingCardId: null,
    highlightedSlotId: null,
    canSpread: false,
    canRepair: true,
    canCollapse: true,
    canResetSpread: placedCards.length > 0,
    canReveal: placedCards.length > 0 && hasHiddenCard,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TarotTablePage />
    </MemoryRouter>,
  )
}

describe('TarotTablePage reveal flow', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.location.hash = ''
  })

  beforeEach(() => {
    vi.clearAllMocks()
    document.title = 'HOBIHer Hub'
    sceneMock.listener = null
    sceneMock.preloadAssetUrls = []
    sceneMock.snapshot = makeSnapshot([hiddenCard])
    sceneMock.collapse.mockResolvedValue(true)
    sceneMock.returnAllCardsToStack.mockResolvedValue(true)
    sceneMock.resetSpread.mockImplementation(() => {
      sceneMock.snapshot = makeSnapshot([])
      sceneMock.listener?.(sceneMock.snapshot)
      return Promise.resolve(true)
    })
    sceneMock.revealPlacedCards.mockImplementation(() => {
      const revealedCard = { ...hiddenCard, revealed: true }
      sceneMock.snapshot = makeSnapshot([revealedCard])
      sceneMock.listener?.(sceneMock.snapshot)
      return [revealedCard]
    })

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  })

  it('uses the divination-house browser title only while mounted', () => {
    const { unmount } = renderPage()

    expect(document.title).toBe('Snoopy占卜屋')
    unmount()
    expect(document.title).toBe('HOBIHer Hub')
  })

  it('keeps the table chrome visual-only and removes the old control sidebar', () => {
    const { container } = renderPage()

    expect(screen.getByText('Snoopy Arcana')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Snoopy Arcana', level: 1 }),
    ).toBeInTheDocument()
    expect(container.querySelector('aside')).not.toBeInTheDocument()
    expect(container.querySelector('.tarot-controls')).not.toBeInTheDocument()

    const picker = screen.getByRole('radiogroup', { name: '选择牌阵' })
    const spreadOptions = within(picker).getAllByRole('radio')
    expect(spreadOptions).toHaveLength(3)
    expect(spreadOptions.map((option) => option.getAttribute('aria-label'))).toEqual([
      '选择单张指引牌阵',
      '选择三张时间流牌阵',
      '选择凯尔特十字牌阵',
    ])
    spreadOptions.forEach((option) => {
      expect(option.textContent?.trim()).toBe('')
    })

    expect(screen.queryByRole('button', { name: '开牌扇' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重整牌扇' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '收回牌堆' })).not.toBeInTheDocument()

    const collapseButton = screen.getByRole('button', { name: '收起牌扇' })
    const resetSpreadButton = screen.getByRole('button', { name: '收回牌阵中的所有牌' })
    const tableTools = container.querySelector('.tarot-table-tools')
    const surfaceActions = container.querySelector('.tarot-table-surface-actions')
    expect(tableTools).toHaveClass('has-reveal-control')
    expect(surfaceActions?.parentElement).toBe(tableTools)
    expect(collapseButton.parentElement).toBe(surfaceActions)
    expect(resetSpreadButton.parentElement).toBe(surfaceActions)
    expect(tableTools?.querySelector(':scope > .tarot-table-action')).toBeNull()
    expect(collapseButton.textContent?.trim()).toBe('')
    expect(resetSpreadButton.textContent?.trim()).toBe('')
    expect(collapseButton.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/tarot/collapse-fan-button-v1.webp'),
    )
    expect(resetSpreadButton.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/tarot/return-all-button-v1.webp'),
    )
    expect(collapseButton.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
    expect(resetSpreadButton.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
    expect(resetSpreadButton).toBeEnabled()

    const revealButton = screen.getByRole('button', { name: '揭示牌阵' })
    const revealArtwork = revealButton.querySelector('img')
    expect(revealButton).toHaveAccessibleName('揭示牌阵')
    expect(revealArtwork).toHaveAttribute(
      'src',
      expect.stringContaining('/assets/tarot/reveal-button-v2.webp'),
    )
    expect(revealArtwork).toHaveAttribute('aria-hidden', 'true')
    expect(sceneMock.preloadAssetUrls).toEqual(expect.arrayContaining([
      expect.stringContaining('/assets/tarot/collapse-fan-button-v1.webp'),
      expect.stringContaining('/assets/tarot/return-all-button-v1.webp'),
      expect.stringContaining('/assets/tarot/reveal-button-v2.webp'),
    ]))
  })

  it('keeps the entire table covered while textures load and reveals it only at 100%', () => {
    sceneMock.snapshot = {
      ...makeSnapshot([]),
      ready: false,
      loadingProgress: 22,
      loadedAssets: 20,
      totalAssets: 89,
      canRepair: false,
      canCollapse: false,
    }

    const { container } = renderPage()
    const stage = container.querySelector('.tarot-table-stage')
    const sceneHost = container.querySelector('.tarot-scene-host')

    expect(stage).toHaveClass('is-loading')
    expect(stage).toHaveAttribute('aria-busy', 'true')
    expect(sceneHost).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.tarot-table-tools')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '牌桌加载进度' })).toHaveAttribute(
      'aria-valuenow',
      '22',
    )
    expect(screen.getByText('正在生成牌桌')).toBeInTheDocument()

    act(() => {
      sceneMock.snapshot = {
        ...sceneMock.snapshot!,
        loadingProgress: 68,
        loadedAssets: 61,
      }
      sceneMock.listener?.(sceneMock.snapshot)
    })

    expect(stage).toHaveClass('is-loading')
    expect(screen.getByRole('progressbar', { name: '牌桌加载进度' })).toHaveAttribute(
      'aria-valuenow',
      '68',
    )
    expect(container.querySelector('.tarot-table-tools')).not.toBeInTheDocument()

    act(() => {
      sceneMock.snapshot = {
        ...sceneMock.snapshot!,
        ready: true,
        loadingProgress: 100,
        loadedAssets: 89,
        canRepair: true,
        canCollapse: true,
      }
      sceneMock.listener?.(sceneMock.snapshot)
    })

    expect(stage).toHaveClass('is-ready')
    expect(stage).toHaveAttribute('aria-busy', 'false')
    expect(sceneHost).not.toHaveAttribute('aria-hidden')
    expect(screen.queryByRole('progressbar', { name: '牌桌加载进度' })).not.toBeInTheDocument()
    expect(container.querySelector('.tarot-table-tools')).toBeInTheDocument()
  })

  it('returns from the tarot table to the water hash route', async () => {
    window.location.hash = '#/tarot'

    render(
      <HashRouter>
        <Routes>
          <Route path="/tarot" element={<TarotTablePage />} />
          <Route path="/water" element={<h1>喝水测试路由</h1>} />
        </Routes>
      </HashRouter>,
    )

    const backLink = screen.getByRole('link', { name: /返回.*喝水/ })
    expect(backLink).toHaveAttribute('href', '#/water')

    fireEvent.click(backLink)

    expect(await screen.findByRole('heading', { name: '喝水测试路由' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/water')
  })

  it('keeps locked cards hidden during the table flip, then opens and reopens the reading', async () => {
    vi.useFakeTimers()
    const { container } = renderPage()

    expect(container.querySelector('.tarot-results')).not.toBeInTheDocument()
    expect(screen.queryByText('愚者')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('正位关键词')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('img', { name: '核心指引牌位抽中愚者' }),
    ).not.toBeInTheDocument()
    expect(
      container.querySelector(`img[src="${hiddenCard.frontTextureUrl}"]`),
    ).not.toBeInTheDocument()

    const revealButton = screen.getByRole('button', { name: '揭示牌阵' })
    expect(revealButton).toBeEnabled()
    fireEvent.click(revealButton)

    expect(sceneMock.revealPlacedCards).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: '单张指引 · 牌阵揭示' })).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(649)
    })
    expect(screen.queryByRole('dialog', { name: '单张指引 · 牌阵揭示' })).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    const dialog = screen.getByRole('dialog', { name: '单张指引 · 牌阵揭示' })
    expect(
      within(dialog).queryByText(
        '按牌位顺序查看这次抽取。牌面、含义与关键词只在主动揭示后显示。',
      ),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: '核心指引牌位抽中愚者' })).toHaveAttribute(
      'src',
      hiddenCard.frontTextureUrl,
    )
    expect(within(dialog).getByText('01 · 核心指引')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '愚者' })).toBeInTheDocument()
    expect(within(dialog).getByText('关键词')).toBeInTheDocument()
    expect(within(dialog).getByText('新开始')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByTitle('关闭'))
    expect(screen.queryByRole('dialog', { name: '单张指引 · 牌阵揭示' })).not.toBeInTheDocument()

    const reopenButton = screen.getByRole('button', { name: '揭示牌阵' })
    expect(reopenButton).toHaveAttribute('title', '再次查看牌阵')
    fireEvent.click(reopenButton)
    expect(screen.getByRole('dialog', { name: '单张指引 · 牌阵揭示' })).toBeInTheDocument()
    expect(sceneMock.revealPlacedCards).toHaveBeenCalledTimes(2)
  })

  it('does not render the reveal control until a card has been locked', () => {
    sceneMock.snapshot = makeSnapshot([])

    const { container } = renderPage()

    expect(screen.queryByRole('button', { name: '揭示牌阵' })).not.toBeInTheDocument()
    expect(container.querySelector('.tarot-table-tools')).not.toHaveClass('has-reveal-control')
    expect(screen.getByRole('button', { name: '收回牌阵中的所有牌' })).toBeDisabled()
    expect(sceneMock.revealPlacedCards).not.toHaveBeenCalled()
  })

  it('enables returning the spread only when placed cards are idle', () => {
    sceneMock.snapshot = {
      ...makeSnapshot([hiddenCard]),
      mode: 'collapsing',
      canResetSpread: false,
    }
    renderPage()

    const resetSpreadButton = screen.getByRole('button', { name: '收回牌阵中的所有牌' })
    expect(resetSpreadButton).toBeDisabled()

    act(() => {
      sceneMock.snapshot = makeSnapshot([hiddenCard])
      sceneMock.listener?.(sceneMock.snapshot)
    })

    expect(resetSpreadButton).toBeEnabled()
  })

  it('returns every placed card and clears the previous reveal state', async () => {
    vi.useFakeTimers()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '揭示牌阵' }))
    await act(async () => {
      vi.advanceTimersByTime(650)
    })

    const dialog = screen.getByRole('dialog', { name: '单张指引 · 牌阵揭示' })
    fireEvent.click(within(dialog).getByTitle('关闭'))
    expect(screen.getByRole('button', { name: '揭示牌阵' })).toHaveAttribute(
      'title',
      '再次查看牌阵',
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '收回牌阵中的所有牌' }))
      await Promise.resolve()
    })

    expect(sceneMock.resetSpread).toHaveBeenCalledTimes(1)
    expect(sceneMock.returnAllCardsToStack).not.toHaveBeenCalled()
    expect(sceneMock.collapse).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '单张指引 · 牌阵揭示' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '揭示牌阵' })).not.toBeInTheDocument()

    act(() => {
      sceneMock.snapshot = makeSnapshot([hiddenCard])
      sceneMock.listener?.(sceneMock.snapshot)
    })

    expect(screen.getByRole('button', { name: '揭示牌阵' })).toHaveAttribute(
      'title',
      '揭示牌阵',
    )
  })
})
