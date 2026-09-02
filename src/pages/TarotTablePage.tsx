import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { TAROT_CARDS, getTarotCardById } from '../tarot/catalog'
import { TAROT_SPREADS, getTarotSpread, type TarotSpreadId } from '../tarot/spreads'
import {
  TarotScene,
  type TarotPlacedCard,
  type TarotSceneSnapshot,
} from '../tarot/TarotScene'
import '../styles/tarot-table.css'

const DEFAULT_SPREAD_ID: TarotSpreadId = 'single'

function tarotAssetUrl(filename: string) {
  return `${import.meta.env.BASE_URL}assets/tarot/${filename}`
}

function SpreadGlyph({ spread }: { spread: (typeof TAROT_SPREADS)[number] }) {
  return (
    <span className={`tarot-spread-glyph__diagram tarot-spread-glyph__diagram--${spread.id}`}>
      {spread.slots.map((slot) => (
        <img
          aria-hidden="true"
          className="tarot-spread-glyph__slot"
          key={slot.id}
          src={tarotAssetUrl('slot-frame.webp')}
          alt=""
          draggable={false}
          style={{
            left: `${slot.x * 100}%`,
            top: `${slot.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${slot.rotationDeg}deg)`,
          }}
        />
      ))}
    </span>
  )
}

export function TarotTablePage() {
  const sceneHostRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<TarotScene | null>(null)
  const revealButtonRef = useRef<HTMLButtonElement | null>(null)
  const revealOpenTimerRef = useRef<number | null>(null)
  const [sceneSnapshot, setSceneSnapshot] = useState<TarotSceneSnapshot | null>(null)
  const [notice, setNotice] = useState('点击桌上的牌堆展开牌扇。')
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [revealedCards, setRevealedCards] = useState<readonly TarotPlacedCard[]>([])
  const [revealOpen, setRevealOpen] = useState(false)

  const closeRevealModal = useCallback(() => {
    if (revealOpenTimerRef.current !== null) {
      window.clearTimeout(revealOpenTimerRef.current)
      revealOpenTimerRef.current = null
    }
    setRevealOpen(false)
    window.setTimeout(() => revealButtonRef.current?.focus(), 0)
  }, [])

  const clearRevealModal = useCallback(() => {
    if (revealOpenTimerRef.current !== null) {
      window.clearTimeout(revealOpenTimerRef.current)
      revealOpenTimerRef.current = null
    }
    setRevealOpen(false)
    setRevealedCards([])
  }, [])

  useEffect(
    () => () => {
      if (revealOpenTimerRef.current !== null) {
        window.clearTimeout(revealOpenTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!revealOpen) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFrame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>('.tarot-page .modal__head .icon-button')
        ?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRevealModal()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = document.querySelector<HTMLElement>('.tarot-page .modal')
      const focusable = dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
            ),
          )
        : []
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleBackdropPointer = (event: PointerEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.classList.contains('modal-backdrop')
      ) {
        closeRevealModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handleBackdropPointer)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handleBackdropPointer)
      previouslyFocused?.focus()
    }
  }, [closeRevealModal, revealOpen])

  useEffect(() => {
    const host = sceneHostRef.current
    if (!host) return

    let scene: TarotScene | null = null
    let unsubscribe: (() => void) | null = null

    try {
      scene = new TarotScene(host, {
        cards: TAROT_CARDS,
        initialSpreadId: DEFAULT_SPREAD_ID,
        maxPixelRatio: 2,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      })
      sceneRef.current = scene
      scene.mount()
      setSceneSnapshot(scene.getSnapshot())
      unsubscribe = scene.subscribe(setSceneSnapshot)
      setSceneError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知初始化错误'
      setSceneError(message)
      setNotice('牌桌没有成功启动，请刷新页面后再试。')
    }

    return () => {
      unsubscribe?.()
      scene?.destroy()
      if (sceneRef.current === scene) sceneRef.current = null
    }
  }, [])

  const currentSpread =
    getTarotSpread(sceneSnapshot?.spreadId ?? DEFAULT_SPREAD_ID) ?? TAROT_SPREADS[0]
  const placedCards = sceneSnapshot?.placedCards ?? []
  const activeSceneError = sceneError ?? sceneSnapshot?.error ?? null
  const sceneBusy =
    sceneSnapshot?.mode === 'spreading' ||
    sceneSnapshot?.mode === 'repairing' ||
    sceneSnapshot?.mode === 'collapsing'
  const canOpenReveal = placedCards.length > 0 && !sceneBusy
  const canCollapseFan = sceneSnapshot?.canCollapse ?? false
  const canReturnSpreadCards = sceneSnapshot?.canResetSpread ?? false

  useEffect(() => {
    if ((sceneSnapshot?.placedCards.length ?? 0) === 0 && revealedCards.length > 0) {
      clearRevealModal()
    }
  }, [clearRevealModal, revealedCards.length, sceneSnapshot?.placedCards.length])

  const selectSpread = useCallback(
    (spreadId: TarotSpreadId) => {
      const scene = sceneRef.current
      if (!scene) {
        setNotice('牌桌仍在准备，请稍等一下。')
        return
      }

      const spread = getTarotSpread(spreadId)
      if (scene.setSpread(spreadId)) {
        clearRevealModal()
        setNotice(`已切换到${spread?.nameZh ?? '新牌阵'}。`)
      } else {
        setNotice('当前动作尚未完成，请等牌桌稳定后再切换。')
      }
    },
    [clearRevealModal],
  )

  const revealSpread = useCallback(() => {
    const scene = sceneRef.current
    if (!scene || placedCards.length === 0) {
      setNotice('先把牌放进牌阵，再揭示牌面。')
      return
    }

    const shouldPlayTableFlip = placedCards.some((card) => !card.revealed)
    const revealed = [...scene.revealPlacedCards()].sort(
      (left, right) => left.slotOrder - right.slotOrder,
    )
    if (revealed.length > 0) setRevealedCards(revealed)

    if (revealed.length > 0 || revealedCards.length > 0) {
      if (revealOpenTimerRef.current !== null) {
        window.clearTimeout(revealOpenTimerRef.current)
        revealOpenTimerRef.current = null
      }
      if (shouldPlayTableFlip) {
        setNotice('牌面正在桌上翻开。')
        revealOpenTimerRef.current = window.setTimeout(() => {
          revealOpenTimerRef.current = null
          setRevealOpen(true)
          setNotice('牌阵已经揭示。')
        }, 650)
      } else {
        setRevealOpen(true)
        setNotice('牌阵已经揭示。')
      }
    } else {
      setNotice('牌槽仍在锁定，请等卡牌稳定后再揭示。')
    }
  }, [placedCards.length, revealedCards])

  const collapseFan = useCallback(async () => {
    const scene = sceneRef.current
    if (!scene) {
      setNotice('牌桌仍在准备，请稍等一下。')
      return
    }

    setNotice('牌扇正在收起。')
    const collapsed = await scene.collapse()
    setNotice(collapsed ? '牌扇已经收起，牌阵中的牌会留在原位。' : '现在还不能收起牌扇。')
  }, [])

  const returnSpreadCards = useCallback(async () => {
    const scene = sceneRef.current
    if (!scene) {
      setNotice('牌桌仍在准备，请稍等一下。')
      return
    }

    setNotice('正在收回牌阵中的卡牌。')
    const returnPromise = scene.resetSpread()
    clearRevealModal()
    const returned = await returnPromise
    setNotice(
      returned
        ? '牌阵中的卡牌已经收回，当前牌扇保持原样。'
        : '牌阵中没有可以收回的卡牌。',
    )
  }, [clearRevealModal])

  return (
    <main className="tarot-page">
      <header className="tarot-topbar">
        <Link className="tarot-back-button" to="/water" aria-label="返回喝水页面">
          <ArrowLeft aria-hidden="true" size={20} />
          <span>返回</span>
        </Link>

        <div className="tarot-heading">
          <h1>Snoopy Arcana</h1>
        </div>

        <div
          className={`tarot-ready-state${activeSceneError ? ' tarot-ready-state--error' : ''}`}
          role="status"
        >
          <span aria-hidden="true" />
          {activeSceneError
            ? '牌桌连接失败'
            : sceneSnapshot?.ready
              ? '牌桌已就绪'
              : '正在准备牌桌'}
        </div>
      </header>

      <div className="tarot-workspace">
        <section className="tarot-table-stage" aria-labelledby="tarot-table-title">
          <h2 className="tarot-sr-only" id="tarot-table-title">
            {currentSpread.nameZh}塔罗牌桌
          </h2>
          <img
            className="tarot-table-fallback"
            src={tarotAssetUrl('table.webp')}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div
            ref={sceneHostRef}
            className="tarot-scene-host"
            aria-label="点击牌堆展开牌扇；长按卡牌蓄力抓起；放大后轻拖牌面可左右浏览"
          />

          <div
            className={`tarot-table-tools${placedCards.length > 0 ? ' has-reveal-control' : ''}`}
          >
            <div className="tarot-table-surface-actions">
              <button
                className="tarot-table-action tarot-table-action--collapse"
                type="button"
                aria-label="收起牌扇"
                disabled={!canCollapseFan}
                onClick={() => void collapseFan()}
              >
                <img
                  src={tarotAssetUrl('collapse-fan-button-v1.webp')}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </button>

              <button
                className="tarot-table-action tarot-table-action--return-all"
                type="button"
                aria-label="收回牌阵中的所有牌"
                disabled={!canReturnSpreadCards}
                onClick={() => void returnSpreadCards()}
              >
                <img
                  src={tarotAssetUrl('return-all-button-v1.webp')}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </button>
            </div>

            <div className="tarot-spread-dock" role="radiogroup" aria-label="选择牌阵">
              {TAROT_SPREADS.map((spread) => {
                const active = currentSpread.id === spread.id
                return (
                  <button
                    className={`tarot-spread-glyph${active ? ' is-active' : ''}`}
                    disabled={!sceneSnapshot?.ready || sceneBusy}
                    key={spread.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`选择${spread.nameZh}牌阵`}
                    title={spread.nameZh}
                    onClick={() => selectSpread(spread.id)}
                  >
                    <SpreadGlyph spread={spread} />
                  </button>
                )
              })}
            </div>

            {placedCards.length > 0 ? (
              <button
                ref={revealButtonRef}
                className="tarot-table-reveal"
                type="button"
                aria-label="揭示牌阵"
                aria-haspopup="dialog"
                title={revealedCards.length > 0 ? '再次查看牌阵' : '揭示牌阵'}
                disabled={!canOpenReveal}
                onClick={revealSpread}
              >
                <img
                  src={tarotAssetUrl('reveal-button-v2.webp')}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </button>
            ) : null}
          </div>

          <p className="tarot-sr-only" aria-live="polite">
            {notice}
          </p>

          {!sceneSnapshot?.ready && !activeSceneError ? (
            <div className="tarot-loading" role="status">
              <Sparkles aria-hidden="true" size={22} />
              正在摆放卡牌与小豆泥猫爪…
            </div>
          ) : null}
          {activeSceneError ? (
            <div className="tarot-loading tarot-loading--error" role="alert">
              牌桌初始化失败：{activeSceneError}
            </div>
          ) : null}
        </section>
      </div>

      <Modal
        title={`${currentSpread.nameZh} · 牌阵揭示`}
        open={revealOpen}
        onClose={closeRevealModal}
      >
        <div className="tarot-reveal-dialog">
          <ol className="tarot-reveal-list">
            {revealedCards.map((card) => {
              const cardMeta = getTarotCardById(card.cardId)
              return (
                <li key={card.slotId}>
                  <img
                    src={card.frontTextureUrl}
                    alt={`${card.slotLabelZh}牌位抽中${card.nameZh}`}
                    draggable={false}
                  />
                  <div className="tarot-reveal-copy">
                    <span>
                      {String(card.slotOrder).padStart(2, '0')} · {card.slotLabelZh}
                    </span>
                    <h3>{card.nameZh}</h3>
                    <small>{card.nameEn}</small>
                    <div className="tarot-reveal-meaning">
                      <strong>牌位含义</strong>
                      <p>{card.slotMeaningZh}</p>
                    </div>
                    {cardMeta ? (
                      <div className="tarot-keywords" aria-label="正位关键词">
                        {cardMeta.uprightKeywordsZh.map((keyword) => (
                          <span key={keyword}>{keyword}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </Modal>
    </main>
  )
}
