import Matter from 'matter-js'
import * as THREE from 'three'
import {
  createFallbackCardBackTexture,
  createFallbackCardFrontTexture,
  createFallbackMagicRingTexture,
  createFallbackParticleTexture,
  createFallbackPawTexture,
  createFallbackSlotTexture,
  createFallbackTableTexture,
  loadTextureInto,
  resolveTarotAssets,
  type TarotAssetManifest,
  type TarotAssetOverrides,
} from './assets'
import {
  clampFanSpacingZoom,
  createStackLayout,
  findSpreadSlotAtPoint,
  getFanPanRange,
  getSpreadSlotPoses,
  resetFanViewport,
  transformFanX,
  type SpreadSlotPose,
} from './layout'
import { TAROT_SPREADS } from './spreads'
import type { Point2D, TarotSpread, TarotSpreadSlot } from './types'

const TABLE_WIDTH = 1600
const TABLE_HEIGHT = 900
const CARD_WIDTH = 96
const CARD_HEIGHT = 168
const CARD_HULL_WIDTH = CARD_WIDTH * 0.92
const CARD_HULL_HEIGHT = CARD_HEIGHT * 0.94
const WORLD_SCALE = 0.01
const CARD_WORLD_WIDTH = CARD_WIDTH * WORLD_SCALE
const CARD_WORLD_HEIGHT = CARD_HEIGHT * WORLD_SCALE
const CARD_THICKNESS = 0.025
const FIXED_STEP_MS = 1000 / 120
const MAX_SUB_STEPS = 5
const DRAG_LIFT = 0.82
const LOCKED_CARD_LIFT = 0.085
const PAW_WORLD_HEIGHT = 1.08
const PAW_FALLBACK_ASPECT = 2 / 3
const FAN_CENTER = { x: TABLE_WIDTH * 0.5, y: 720 }
// Keep the deck inside the fixed camera's narrowest horizontal frustum. At the
// old x=245 position the full card width fell outside portrait-like table stages.
const DECK_CENTER = { x: 530, y: 650 }
const SPREAD_ORIGIN = { x: 260, y: 62 }
const SPREAD_TABLE_SIZE = { width: 1140, height: 610 }
const FAN_VIEWPORT_CENTER_WIDTH = TABLE_WIDTH - 260 - CARD_WIDTH
const FAN_WHEEL_SENSITIVITY = 0.00125
const PAW_PLACE_DURATION_MS = 450
const CARD_HOLD_DURATION_MS = 400
const CARD_HOLD_INDICATOR_DELAY_MS = 140
const CARD_HOLD_MOVE_THRESHOLD_PX = 11

const COLLISION = {
  wall: 0x0001,
  anchored: 0x0002,
  loose: 0x0004,
  dragged: 0x0008,
  locked: 0x0010,
} as const

const ALL_CARD_COLLISIONS =
  COLLISION.wall |
  COLLISION.anchored |
  COLLISION.loose |
  COLLISION.dragged |
  COLLISION.locked

export type TarotSceneMode =
  | 'stacked'
  | 'spreading'
  | 'fan'
  | 'repairing'
  | 'collapsing'

export interface TarotSceneCard {
  id: string
  deckIndex?: number
  nameZh?: string
  nameEn?: string
  frontTextureUrl?: string
}

export interface TarotPlacedCard {
  cardId: string
  deckIndex: number
  nameZh: string
  nameEn: string
  frontTextureUrl: string
  spreadId: string
  slotId: string
  slotOrder: number
  slotLabelZh: string
  slotLabelEn: string
  slotMeaningZh: string
  revealed: boolean
}

export interface TarotSceneSnapshot {
  ready: boolean
  error: string | null
  mode: TarotSceneMode
  spreadId: string
  occupiedSlots: Readonly<Record<string, string>>
  placedCards: readonly TarotPlacedCard[]
  draggingCardId: string | null
  highlightedSlotId: string | null
  canSpread: boolean
  canRepair: boolean
  canCollapse: boolean
  canResetSpread: boolean
  canReveal: boolean
}

export type TarotSceneEvent =
  | { type: 'ready'; snapshot: TarotSceneSnapshot }
  | { type: 'error'; error: string; snapshot: TarotSceneSnapshot }
  | { type: 'modechange'; mode: TarotSceneMode; snapshot: TarotSceneSnapshot }
  | { type: 'spreadchange'; spreadId: string; snapshot: TarotSceneSnapshot }
  | { type: 'spreadreset'; spreadId: string; snapshot: TarotSceneSnapshot }
  | { type: 'dragstart'; cardId: string; snapshot: TarotSceneSnapshot }
  | { type: 'dragend'; cardId: string; snapshot: TarotSceneSnapshot }
  | {
      type: 'cardlocked'
      cardId: string
      slotId: string
      spreadId: string
      snapshot: TarotSceneSnapshot
    }
  | {
      type: 'cardrevealed'
      cardId: string
      slotId: string
      spreadId: string
      snapshot: TarotSceneSnapshot
    }

export interface TarotSceneOptions {
  cards?: readonly TarotSceneCard[]
  spreads?: readonly TarotSpread[]
  initialSpreadId?: string
  assets?: TarotAssetOverrides
  random?: () => number
  maxPixelRatio?: number
  reducedMotion?: boolean
  onEvent?: (event: TarotSceneEvent) => void
}

type SceneListener = (snapshot: TarotSceneSnapshot) => void
type CardState =
  | 'stacked'
  | 'transitioning'
  | 'fan-anchored'
  | 'loose'
  | 'dragged'
  | 'slot-locked'

interface NormalizedCard {
  id: string
  deckIndex: number
  nameZh: string
  nameEn: string
  frontTextureUrl: string
}

interface CardPose {
  x: number
  y: number
  angle: number
  zIndex: number
}

interface CardRuntime {
  data: NormalizedCard
  body: Matter.Body
  root: THREE.Group
  flipGroup: THREE.Group
  pickMeshes: THREE.Mesh[]
  frontMaterial: THREE.MeshStandardMaterial
  homePose: CardPose
  stackPose: CardPose
  state: CardState
  visualLift: number
  transitionLift: number
  flipProgress: number
  flipTarget: number
  frontLoadStarted: boolean
  frontLoadPromise: Promise<void> | null
}

interface TransitionEntry {
  card: CardRuntime
  from: CardPose
  to: CardPose
  control: Point2D
  delayMs: number
  travelMs: number
}

interface ActiveTransition {
  kind: 'spread' | 'repair' | 'collapse'
  startedAt: number
  entries: TransitionEntry[]
  totalMs: number
  resolve: (completed: boolean) => void
}

interface SnapTween {
  card: CardRuntime
  slot: TarotSpreadSlot
  pose: SpreadSlotPose
  startedAt: number
  durationMs: number
  from: CardPose
  to: CardPose
}

interface PlacedRuntime {
  card: CardRuntime
  slot: TarotSpreadSlot
  revealed: boolean
}

interface ParticleRuntime {
  sprite: THREE.Sprite
  velocity: THREE.Vector3
  age: number
  duration: number
  spin: number
}

interface MagicRingRuntime {
  root: THREE.Group
  material: THREE.MeshBasicMaterial
  age: number
  duration: number
}

interface DragRuntime {
  card: CardRuntime
  pointerId: number
  rawTarget: Matter.Vector
  grabOffset: Matter.Vector
  originState: CardState
  originPlacement: PlacedRuntime | null
}

interface PointerSample {
  clientX: number
  clientY: number
  pointerType: string
}

interface FanPanRuntime {
  pointerId: number
  lastPhysicsX: number
}

interface PendingCardHoldRuntime {
  card: CardRuntime
  pointerId: number
  startClientX: number
  startClientY: number
  startPhysicsX: number
  initialPanX: number
  startedAt: number
  durationMs: number
}

interface HoldIndicatorRuntime {
  sprite: THREE.Sprite
  material: THREE.SpriteMaterial
  texture: THREE.CanvasTexture
  context: CanvasRenderingContext2D
}

interface FanPinchRuntime {
  pointerIds: [number, number]
  initialDistance: number
  initialZoom: number
}

interface PawPlacementRuntime {
  card: CardRuntime
  target: Point2D
  startedAt: number
  durationMs: number
}

interface SharedVisualResources {
  cardPlaneGeometry: THREE.PlaneGeometry
  cardEdgeGeometry: THREE.BoxGeometry
  slotPlaneGeometry: THREE.PlaneGeometry
  ringPlaneGeometry: THREE.PlaneGeometry
  edgeMaterial: THREE.MeshStandardMaterial
  backMaterial: THREE.MeshStandardMaterial
  fallbackFrontTexture: THREE.Texture
  fallbackSlotTexture: THREE.Texture
  fallbackParticleTexture: THREE.Texture
  fallbackRingTexture: THREE.Texture
  fallbackPawOpenTexture: THREE.Texture
  fallbackPawGrabTexture: THREE.Texture
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3
}

function shortestAngleDelta(start: number, end: number): number {
  return Math.atan2(Math.sin(end - start), Math.cos(end - start))
}

function quadraticBezier(
  start: number,
  control: number,
  end: number,
  progress: number,
): number {
  const inverse = 1 - progress
  return inverse * inverse * start + 2 * inverse * progress * control + progress * progress * end
}

function physicsToWorldX(x: number): number {
  return (x - TABLE_WIDTH / 2) * WORLD_SCALE
}

function physicsToWorldZ(y: number): number {
  return (y - TABLE_HEIGHT / 2) * WORLD_SCALE
}

function worldToPhysics(point: THREE.Vector3): Matter.Vector {
  return {
    x: point.x / WORLD_SCALE + TABLE_WIDTH / 2,
    y: point.z / WORLD_SCALE + TABLE_HEIGHT / 2,
  }
}

function createDefaultCards(): TarotSceneCard[] {
  return Array.from({ length: 78 }, (_, index) => ({
    id: `tarot-${String(index + 1).padStart(2, '0')}`,
    deckIndex: index,
    nameZh: `塔罗牌 ${index + 1}`,
    nameEn: `Tarot ${index + 1}`,
  }))
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(clamp(random(), 0, 0.999999999) * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function makeFanPoses(cardCount: number): CardPose[] {
  const denominator = Math.max(1, cardCount - 1)
  return Array.from({ length: cardCount }, (_, index) => {
    const progress = cardCount === 1 ? 0.5 : index / denominator
    const arc = (progress - 0.5) * 1.76
    return {
      x: FAN_CENTER.x + Math.sin(arc) * 620,
      y: FAN_CENTER.y - (1 - Math.cos(arc)) * 360,
      angle: arc * 0.72,
      zIndex: index,
    }
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class TarotScene {
  private readonly container: HTMLElement
  private readonly options: TarotSceneOptions
  private readonly random: () => number
  private readonly assets: TarotAssetManifest
  private readonly spreads: readonly TarotSpread[]
  private readonly maxPixelRatio: number
  private readonly reducedMotion: boolean
  private readonly listeners = new Set<SceneListener>()
  private readonly ownedTextures = new Set<THREE.Texture>()
  private readonly bodyToCard = new Map<number, CardRuntime>()
  private readonly placedBySlot = new Map<string, PlacedRuntime>()
  private readonly slotVisuals = new Map<
    string,
    { root: THREE.Group; material: THREE.MeshBasicMaterial }
  >()
  private readonly particles: ParticleRuntime[] = []

  private mounted = false
  private destroyed = false
  private ready = false
  private error: string | null = null
  private mode: TarotSceneMode = 'stacked'
  private currentSpread: TarotSpread
  private highlightedSlotId: string | null = null
  private cards: CardRuntime[] = []
  private transition: ActiveTransition | null = null
  private snapTweens = new Map<string, SnapTween>()
  private drag: DragRuntime | null = null

  private engine: Matter.Engine | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private tableMesh: THREE.Mesh | null = null
  private tableMaterial: THREE.MeshStandardMaterial | null = null
  private cardGroup: THREE.Group | null = null
  private slotGroup: THREE.Group | null = null
  private fxGroup: THREE.Group | null = null
  private paw: THREE.Sprite | null = null
  private pawOpenMaterial: THREE.SpriteMaterial | null = null
  private pawGrabMaterial: THREE.SpriteMaterial | null = null
  private pawPlaceMaterial: THREE.SpriteMaterial | null = null
  private pawPlacement: PawPlacementRuntime | null = null
  private holdIndicator: HoldIndicatorRuntime | null = null
  private magicRing: MagicRingRuntime | null = null
  private shared: SharedVisualResources | null = null
  private resolvedSlotTexture: THREE.Texture | null = null

  private raycaster = new THREE.Raycaster()
  private pointerNdc = new THREE.Vector2()
  private pointerTableWorld = new THREE.Vector3()
  private pointerVisible = false
  private pointerVelocityX = 0
  private lastPointerClientX = 0
  private lastPointerAt = 0
  private resizeObserver: ResizeObserver | null = null
  private animationFrame = 0
  private lastFrameAt = 0
  private accumulatorMs = 0
  private fanZoom = 1
  private fanPanX = 0
  private fanPan: FanPanRuntime | null = null
  private fanPinch: FanPinchRuntime | null = null
  private pendingCardHold: PendingCardHoldRuntime | null = null
  private readonly activePointers = new Map<number, PointerSample>()

  private readonly handleResizeBound = () => this.resize()
  private readonly handleVisibilityBound = () => this.handleVisibilityChange()
  private readonly handlePointerDownBound = (event: PointerEvent) =>
    this.handlePointerDown(event)
  private readonly handlePointerMoveBound = (event: PointerEvent) =>
    this.handlePointerMove(event)
  private readonly handlePointerUpBound = (event: PointerEvent) =>
    this.handlePointerUp(event)
  private readonly handlePointerCancelBound = (event: PointerEvent) =>
    this.handlePointerCancel(event)
  private readonly handleLostPointerCaptureBound = (event: PointerEvent) =>
    this.handleLostPointerCapture(event)
  private readonly handlePointerEnterBound = (event: PointerEvent) =>
    this.handlePointerEnter(event)
  private readonly handlePointerLeaveBound = () => this.handlePointerLeave()
  private readonly handleWheelBound = (event: WheelEvent) => this.handleWheel(event)
  private readonly handleWindowBlurBound = () => this.handleWindowBlur()

  constructor(container: HTMLElement, options: TarotSceneOptions = {}) {
    this.container = container
    this.options = options
    this.random = options.random ?? Math.random
    this.assets = resolveTarotAssets(options.assets)
    this.spreads = options.spreads?.length ? options.spreads : TAROT_SPREADS
    this.currentSpread =
      this.spreads.find((spread) => spread.id === options.initialSpreadId) ??
      this.spreads[0]
    this.maxPixelRatio = clamp(options.maxPixelRatio ?? 1.75, 1, 2)
    this.reducedMotion =
      options.reducedMotion ??
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true)
  }

  mount(): this {
    if (this.mounted) return this
    if (this.destroyed) {
      throw new Error('A destroyed TarotScene cannot be mounted again.')
    }

    this.mounted = true
    try {
      this.initializeThree()
      this.initializePhysics()
      this.initializeCards()
      this.initializeSlots()
      this.initializeEffects()
      this.bindEvents()
      this.resize()
      this.ready = true
      this.lastFrameAt = performance.now()
      this.animationFrame = requestAnimationFrame((time) => this.frame(time))
      this.emitSnapshot()
      this.options.onEvent?.({ type: 'ready', snapshot: this.getSnapshot() })
      void this.loadGeneratedTextures()
    } catch (error) {
      this.error = errorMessage(error)
      this.ready = false
      this.emitSnapshot()
      this.options.onEvent?.({
        type: 'error',
        error: this.error,
        snapshot: this.getSnapshot(),
      })
    }
    return this
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.ready = false
    this.mounted = false
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0

    if (this.transition) {
      this.transition.resolve(false)
      this.transition = null
    }
    this.endDrag(false)
    this.unbindEvents()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    const tableStage = this.container.closest<HTMLElement>('.tarot-table-stage')
    tableStage?.style.removeProperty('--tarot-table-top')
    tableStage?.style.removeProperty('--tarot-table-side-inset')

    if (this.engine) {
      Matter.Composite.clear(this.engine.world, false, true)
      Matter.Engine.clear(this.engine)
      this.engine = null
    }

    this.cards.forEach((card) => card.frontMaterial.dispose())
    this.cards = []
    this.snapTweens.clear()
    this.bodyToCard.clear()
    this.placedBySlot.clear()
    this.slotVisuals.forEach(({ material }) => material.dispose())
    this.slotVisuals.clear()
    this.particles.forEach(({ sprite }) => {
      ;(sprite.material as THREE.SpriteMaterial).dispose()
    })
    this.particles.length = 0
    this.pawOpenMaterial?.dispose()
    this.pawGrabMaterial?.dispose()
    this.pawPlaceMaterial?.dispose()
    this.holdIndicator?.material.dispose()
    this.magicRing?.material.dispose()
    this.tableMaterial?.dispose()
    if (this.tableMesh?.geometry) this.tableMesh.geometry.dispose()

    if (this.shared) {
      this.shared.cardPlaneGeometry.dispose()
      this.shared.cardEdgeGeometry.dispose()
      this.shared.slotPlaneGeometry.dispose()
      this.shared.ringPlaneGeometry.dispose()
      this.shared.edgeMaterial.dispose()
      this.shared.backMaterial.dispose()
      this.shared = null
    }

    for (const texture of this.ownedTextures) texture.dispose()
    this.ownedTextures.clear()

    if (this.renderer) {
      const canvas = this.renderer.domElement
      this.renderer.dispose()
      this.renderer.forceContextLoss()
      if (canvas.parentElement === this.container) canvas.remove()
      this.renderer = null
    }

    this.scene?.clear()
    this.scene = null
    this.camera = null
    this.tableMesh = null
    this.tableMaterial = null
    this.cardGroup = null
    this.slotGroup = null
    this.fxGroup = null
    this.paw = null
    this.pawPlacement = null
    this.holdIndicator = null
    this.activePointers.clear()
    this.fanPan = null
    this.fanPinch = null
    this.pendingCardHold = null
    this.magicRing = null
    this.resolvedSlotTexture = null
    this.listeners.clear()
  }

  subscribe(listener: SceneListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): TarotSceneSnapshot {
    const occupiedSlots: Record<string, string> = {}
    for (const [slotId, placed] of this.placedBySlot) {
      occupiedSlots[slotId] = placed.card.data.id
    }
    const placedCards = [...this.placedBySlot.values()]
      .sort((left, right) => left.slot.order - right.slot.order)
      .map((placed): TarotPlacedCard => ({
        cardId: placed.card.data.id,
        deckIndex: placed.card.data.deckIndex,
        nameZh: placed.card.data.nameZh,
        nameEn: placed.card.data.nameEn,
        frontTextureUrl: placed.card.data.frontTextureUrl,
        spreadId: this.currentSpread.id,
        slotId: placed.slot.id,
        slotOrder: placed.slot.order,
        slotLabelZh: placed.slot.labelZh,
        slotLabelEn: placed.slot.labelEn,
        slotMeaningZh: placed.slot.meaningZh,
        revealed: placed.revealed,
      }))
    const idle =
      this.transition === null &&
      this.snapTweens.size === 0 &&
      this.drag === null &&
      this.pendingCardHold === null &&
      this.fanPan === null &&
      this.fanPinch === null
    const hasUnrevealedCards = [...this.placedBySlot.values()].some((placed) => !placed.revealed)

    return {
      ready: this.ready,
      error: this.error,
      mode: this.mode,
      spreadId: this.currentSpread.id,
      occupiedSlots,
      placedCards,
      draggingCardId: this.drag?.card.data.id ?? null,
      highlightedSlotId: this.highlightedSlotId,
      canSpread:
        this.ready &&
        this.mode === 'stacked' &&
        this.cards.some((card) => card.state === 'stacked') &&
        idle,
      canRepair: this.ready && this.mode === 'fan' && idle,
      canCollapse: this.ready && this.mode === 'fan' && idle,
      canResetSpread: this.ready && this.placedBySlot.size > 0 && idle,
      canReveal: this.ready && this.placedBySlot.size > 0 && hasUnrevealedCards && idle,
    }
  }

  setSpread(spreadId: string): boolean {
    if (
      !this.ready ||
      this.transition ||
      this.snapTweens.size > 0 ||
      this.drag ||
      this.pendingCardHold ||
      this.fanPan ||
      this.fanPinch
    ) {
      return false
    }
    const spread = this.spreads.find((candidate) => candidate.id === spreadId)
    if (!spread || spread.id === this.currentSpread.id) return spread !== undefined

    const hadPlacedCards = this.placedBySlot.size > 0
    const releasedCards = hadPlacedCards ? this.releasePlacedCards() : []
    this.currentSpread = spread
    this.initializeSlots()
    if (this.mode !== 'fan') {
      for (const card of releasedCards) this.stackCard(card)
    }
    this.emitSnapshot()
    this.options.onEvent?.({
      type: 'spreadchange',
      spreadId,
      snapshot: this.getSnapshot(),
    })
    if (hadPlacedCards && this.mode === 'fan') {
      void this.repair()
    }
    return true
  }

  spread(): Promise<boolean> {
    if (!this.getSnapshot().canSpread) return Promise.resolve(false)
    const cards = this.cards.filter((card) => card.state !== 'slot-locked')
    if (cards.length === 0) return Promise.resolve(false)
    const targets = new Map(cards.map((card) => [card.data.id, this.getFanPose(card)]))
    this.setMode('spreading')
    this.startMagic(FAN_CENTER, this.reducedMotion ? 0.2 : 1.1)
    return this.beginTransition('spread', cards, targets, () => {
      for (const card of cards) this.anchorCard(card)
      this.setMode('fan')
    })
  }

  repair(): Promise<boolean> {
    if (!this.getSnapshot().canRepair) return Promise.resolve(false)
    const cards = this.cards.filter((card) => card.state !== 'slot-locked')
    const targets = new Map(cards.map((card) => [card.data.id, this.getFanPose(card)]))
    this.setMode('repairing')
    this.startMagic(FAN_CENTER, this.reducedMotion ? 0.2 : 1.05)
    return this.beginTransition('repair', cards, targets, () => {
      for (const card of cards) this.anchorCard(card)
      this.setMode('fan')
    })
  }

  collapse(): Promise<boolean> {
    if (!this.getSnapshot().canCollapse) return Promise.resolve(false)
    return this.collapseUnlockedCards()
  }

  /**
   * Clears every occupied spread slot and returns the complete deck to one
   * face-down stack. Unlike collapse(), this intentionally includes cards
   * that are currently locked into the spread.
   */
  returnAllCardsToStack(): Promise<boolean> {
    if (
      !this.ready ||
      this.transition ||
      this.snapTweens.size > 0 ||
      this.drag ||
      this.pendingCardHold ||
      this.fanPan ||
      this.fanPinch
    ) {
      return Promise.resolve(false)
    }

    const hadPlacedCards = this.placedBySlot.size > 0
    const needsReturn =
      hadPlacedCards ||
      this.mode !== 'stacked' ||
      this.cards.some((card) => card.state !== 'stacked')
    if (!needsReturn) return Promise.resolve(false)

    if (hadPlacedCards) this.releasePlacedCards()
    for (const card of this.cards) card.flipTarget = 0
    this.setHighlightedSlot(null)

    if (hadPlacedCards) {
      this.emitSnapshot()
      this.options.onEvent?.({
        type: 'spreadreset',
        spreadId: this.currentSpread.id,
        snapshot: this.getSnapshot(),
      })
    }

    // Once the slot map is cleared, every card is unlocked. Reusing the
    // collapse path keeps the viewport reset and stack transition atomic.
    return this.collapseUnlockedCards()
  }

  private collapseUnlockedCards(): Promise<boolean> {
    if (
      !this.ready ||
      this.transition ||
      this.snapTweens.size > 0 ||
      this.drag ||
      this.pendingCardHold ||
      this.fanPan ||
      this.fanPinch
    ) {
      return Promise.resolve(false)
    }
    this.resetFanState()
    const cards = this.cards.filter((card) => card.state !== 'slot-locked')
    const targets = new Map(cards.map((card) => [card.data.id, card.stackPose]))
    this.setMode('collapsing')
    this.startMagic(DECK_CENTER, this.reducedMotion ? 0.2 : 1.1)
    return this.beginTransition('collapse', cards, targets, () => {
      for (const card of cards) this.stackCard(card)
      this.setMode('stacked')
    })
  }

  resetSpread(): Promise<boolean> {
    if (!this.getSnapshot().canResetSpread) return Promise.resolve(false)
    const releasedCards = this.releasePlacedCards()
    this.emitSnapshot()
    this.options.onEvent?.({
      type: 'spreadreset',
      spreadId: this.currentSpread.id,
      snapshot: this.getSnapshot(),
    })
    if (this.mode === 'fan') return this.repair()

    // A completed spread may already have collapsed the remaining deck. Keep
    // that pile closed, but visibly fly the released spread cards back into it
    // instead of snapping them to their stack poses in the same frame.
    const targets = new Map(releasedCards.map((card) => [card.data.id, card.stackPose]))
    this.setMode('collapsing')
    this.startMagic(DECK_CENTER, this.reducedMotion ? 0.2 : 1.1)
    return this.beginTransition('collapse', releasedCards, targets, () => {
      for (const card of releasedCards) this.stackCard(card)
      this.setMode('stacked')
    })
  }

  revealPlacedCards(): TarotPlacedCard[] {
    const idle =
      this.transition === null &&
      this.snapTweens.size === 0 &&
      this.drag === null &&
      this.pendingCardHold === null &&
      this.fanPan === null &&
      this.fanPinch === null
    if (!this.ready || !idle) return []

    const newlyRevealed = [...this.placedBySlot.values()].filter((placed) => !placed.revealed)
    for (const placed of newlyRevealed) placed.revealed = true
    const revealedPlacements = [...this.placedBySlot.values()].filter(
      (placed) => placed.revealed,
    )
    // Fronts are preloaded when cards enter slots. Still await the full group
    // here so every generated face is ready and the spread turns in unison.
    void Promise.all(
      revealedPlacements.map((placed) => this.ensureFrontTexture(placed.card)),
    ).then(() => {
      if (this.destroyed) return
      for (const placed of revealedPlacements) {
        const currentPlacement = [...this.placedBySlot.values()].find(
          (candidate) => candidate.card === placed.card,
        )
        if (!currentPlacement?.revealed) continue
        placed.card.flipTarget = 1
      }
    })

    const snapshot = this.getSnapshot()
    if (newlyRevealed.length > 0) {
      this.emitSnapshot()
      for (const placed of newlyRevealed) {
        this.options.onEvent?.({
          type: 'cardrevealed',
          cardId: placed.card.data.id,
          slotId: placed.slot.id,
          spreadId: this.currentSpread.id,
          snapshot,
        })
      }
    }
    return [...snapshot.placedCards]
  }

  private initializeThree(): void {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x071414)
    this.scene = scene

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    const canvas = renderer.domElement
    canvas.setAttribute('aria-label', '2.5D 塔罗牌桌')
    canvas.setAttribute('role', 'application')
    canvas.tabIndex = 0
    Object.assign(canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      touchAction: 'none',
      userSelect: 'none',
      cursor: 'none',
    })
    this.container.appendChild(canvas)
    this.renderer = renderer

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40)
    camera.position.set(0, 7.5, 7.2)
    camera.lookAt(0, 0, 0)
    this.camera = camera

    scene.add(new THREE.HemisphereLight(0xfff1d0, 0x07191b, 1.7))
    const keyLight = new THREE.DirectionalLight(0xffe6ad, 2.45)
    keyLight.position.set(-3.5, 8.5, 5.5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.left = -9
    keyLight.shadow.camera.right = 9
    keyLight.shadow.camera.top = 6
    keyLight.shadow.camera.bottom = -6
    keyLight.shadow.bias = -0.0004
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0x7de3d2, 1.05)
    rimLight.position.set(4, 3.5, -5)
    scene.add(rimLight)

    const fallbackTable = this.trackTexture(createFallbackTableTexture())
    const tableMaterial = new THREE.MeshStandardMaterial({
      map: fallbackTable,
      roughness: 0.92,
      metalness: 0.02,
    })
    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TABLE_WIDTH * WORLD_SCALE, TABLE_HEIGHT * WORLD_SCALE),
      tableMaterial,
    )
    tableMesh.rotation.x = -Math.PI / 2
    tableMesh.receiveShadow = true
    tableMesh.position.y = -0.005
    scene.add(tableMesh)
    this.tableMaterial = tableMaterial
    this.tableMesh = tableMesh

    this.cardGroup = new THREE.Group()
    this.slotGroup = new THREE.Group()
    this.fxGroup = new THREE.Group()
    scene.add(this.slotGroup, this.cardGroup, this.fxGroup)

    const fallbackCardBack = this.trackTexture(createFallbackCardBackTexture())
    const fallbackFront = this.trackTexture(createFallbackCardFrontTexture())
    const fallbackSlot = this.trackTexture(createFallbackSlotTexture())
    const fallbackParticle = this.trackTexture(createFallbackParticleTexture())
    const fallbackRing = this.trackTexture(createFallbackMagicRingTexture())
    const fallbackPawOpen = this.trackTexture(createFallbackPawTexture(false))
    const fallbackPawGrab = this.trackTexture(createFallbackPawTexture(true))
    const backMaterial = new THREE.MeshStandardMaterial({
      map: fallbackCardBack,
      roughness: 0.58,
      metalness: 0.04,
      side: THREE.FrontSide,
    })
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xcdb77b,
      roughness: 0.62,
      metalness: 0.12,
    })
    this.shared = {
      cardPlaneGeometry: new THREE.PlaneGeometry(CARD_WORLD_WIDTH, CARD_WORLD_HEIGHT),
      cardEdgeGeometry: new THREE.BoxGeometry(
        CARD_WORLD_WIDTH,
        CARD_THICKNESS,
        CARD_WORLD_HEIGHT,
      ),
      slotPlaneGeometry: new THREE.PlaneGeometry(
        CARD_WORLD_WIDTH * 1.12,
        CARD_WORLD_HEIGHT * 1.1,
      ),
      ringPlaneGeometry: new THREE.PlaneGeometry(4.4, 4.4),
      edgeMaterial,
      backMaterial,
      fallbackFrontTexture: fallbackFront,
      fallbackSlotTexture: fallbackSlot,
      fallbackParticleTexture: fallbackParticle,
      fallbackRingTexture: fallbackRing,
      fallbackPawOpenTexture: fallbackPawOpen,
      fallbackPawGrabTexture: fallbackPawGrab,
    }
  }

  private initializePhysics(): void {
    const engine = Matter.Engine.create({
      enableSleeping: true,
      positionIterations: 8,
      velocityIterations: 6,
      constraintIterations: 4,
    })
    engine.gravity.x = 0
    engine.gravity.y = 0
    engine.gravity.scale = 0
    // Card collisions are temporarily disabled while the core draw/place flow
    // uses deterministic pointer-driven movement.
    this.engine = engine
  }

  private initializeCards(): void {
    if (!this.engine || !this.cardGroup || !this.shared) {
      throw new Error('Tarot scene resources were not initialized.')
    }
    const sourceCards = this.options.cards?.length ? this.options.cards : createDefaultCards()
    const seenIds = new Set<string>()
    const normalized = sourceCards.map((card, index): NormalizedCard => {
      if (!card.id || seenIds.has(card.id)) {
        throw new Error(`Tarot card ids must be unique. Invalid id at index ${index}.`)
      }
      seenIds.add(card.id)
      return {
        id: card.id,
        deckIndex: card.deckIndex ?? index,
        nameZh: card.nameZh ?? `塔罗牌 ${index + 1}`,
        nameEn: card.nameEn ?? `Tarot ${index + 1}`,
        frontTextureUrl: card.frontTextureUrl ?? this.assets.cardFront(card.id),
      }
    })
    const deck = shuffle(normalized, this.random)
    const stackLayouts = createStackLayout(deck, {
      center: DECK_CENTER,
      offset: { x: 0.46, y: -0.34 },
      rotationStepDeg: 0.045,
      maxVisibleLayers: 18,
    })
    const fanPoses = makeFanPoses(deck.length)

    this.cards = deck.map((data, index) => {
      const stack = stackLayouts[index]
      const stackPose: CardPose = {
        x: stack.x,
        y: stack.y,
        angle: (stack.rotationDeg * Math.PI) / 180,
        zIndex: stack.zIndex,
      }
      const homePose = fanPoses[index]
      const body = Matter.Bodies.rectangle(
        stackPose.x,
        stackPose.y,
        CARD_HULL_WIDTH,
        CARD_HULL_HEIGHT,
        {
          angle: stackPose.angle,
          isStatic: true,
          chamfer: { radius: 6 },
          density: 0.0012,
          friction: 0.26,
          frictionStatic: 0.72,
          frictionAir: 0.065,
          restitution: 0.03,
          sleepThreshold: 35,
          slop: 0.1,
          collisionFilter: {
            category: COLLISION.anchored,
            mask: 0,
          },
          render: { visible: false },
        },
      )
      body.plugin = { ...body.plugin, tarotCardId: data.id }
      const visual = this.createCardVisual(data)
      const runtime: CardRuntime = {
        data,
        body,
        root: visual.root,
        flipGroup: visual.flipGroup,
        pickMeshes: visual.pickMeshes,
        frontMaterial: visual.frontMaterial,
        homePose,
        stackPose,
        state: 'stacked',
        visualLift: 0,
        transitionLift: 0,
        flipProgress: 0,
        flipTarget: 0,
        frontLoadStarted: false,
        frontLoadPromise: null,
      }
      visual.root.userData.cardId = data.id
      for (const mesh of visual.pickMeshes) mesh.userData.cardId = data.id
      this.cardGroup?.add(visual.root)
      this.bodyToCard.set(body.id, runtime)
      return runtime
    })
    Matter.Composite.add(
      this.engine.world,
      this.cards.map((card) => card.body),
    )
    this.updateCardVisuals(0)
  }

  private createCardVisual(data: NormalizedCard): {
    root: THREE.Group
    flipGroup: THREE.Group
    pickMeshes: THREE.Mesh[]
    frontMaterial: THREE.MeshStandardMaterial
  } {
    if (!this.shared) throw new Error('Shared card resources are unavailable.')
    const root = new THREE.Group()
    const flipGroup = new THREE.Group()
    root.add(flipGroup)

    const edge = new THREE.Mesh(this.shared.cardEdgeGeometry, this.shared.edgeMaterial)
    edge.position.y = CARD_THICKNESS / 2
    edge.castShadow = true
    edge.receiveShadow = true
    flipGroup.add(edge)

    const back = new THREE.Mesh(this.shared.cardPlaneGeometry, this.shared.backMaterial)
    back.rotation.x = -Math.PI / 2
    back.position.y = CARD_THICKNESS + 0.0015
    back.castShadow = true
    flipGroup.add(back)

    const frontMaterial = new THREE.MeshStandardMaterial({
      map: this.shared.fallbackFrontTexture,
      roughness: 0.55,
      metalness: 0.03,
      side: THREE.FrontSide,
    })
    frontMaterial.name = `tarot-front-${data.id}`
    const front = new THREE.Mesh(this.shared.cardPlaneGeometry, frontMaterial)
    front.rotation.x = Math.PI / 2
    front.position.y = -0.0015
    front.castShadow = true
    flipGroup.add(front)

    return { root, flipGroup, pickMeshes: [back, front], frontMaterial }
  }

  private initializeSlots(): void {
    if (!this.slotGroup || !this.shared) return
    for (const child of [...this.slotGroup.children]) this.slotGroup.remove(child)
    this.slotVisuals.forEach(({ material }) => material.dispose())
    this.slotVisuals.clear()

    for (const pose of this.getCurrentSlotPoses()) {
      const root = new THREE.Group()
      root.position.set(
        physicsToWorldX(pose.x),
        0.008 + pose.layer * 0.00015,
        physicsToWorldZ(pose.y),
      )
      root.rotation.y = -(pose.rotationDeg * Math.PI) / 180
      const material = new THREE.MeshBasicMaterial({
        map: this.resolvedSlotTexture ?? this.shared.fallbackSlotTexture,
        color: 0xd9c48e,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(this.shared.slotPlaneGeometry, material)
      mesh.rotation.x = -Math.PI / 2
      root.add(mesh)
      this.slotGroup.add(root)
      this.slotVisuals.set(pose.slot.id, { root, material })
    }
  }

  private initializeEffects(): void {
    if (!this.fxGroup || !this.shared) return
    const ringMaterial = new THREE.MeshBasicMaterial({
      map: this.shared.fallbackRingTexture,
      color: 0xffe1a1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const ringRoot = new THREE.Group()
    const ringMesh = new THREE.Mesh(this.shared.ringPlaneGeometry, ringMaterial)
    ringMesh.rotation.x = -Math.PI / 2
    ringRoot.add(ringMesh)
    ringRoot.visible = false
    this.fxGroup.add(ringRoot)
    this.magicRing = { root: ringRoot, material: ringMaterial, age: 0, duration: 1 }

    for (let index = 0; index < 56; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.shared.fallbackParticleTexture,
        color: index % 3 === 0 ? 0x7ee4d1 : 0xffd67f,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const sprite = new THREE.Sprite(material)
      sprite.visible = false
      this.fxGroup.add(sprite)
      this.particles.push({
        sprite,
        velocity: new THREE.Vector3(),
        age: 1,
        duration: 1,
        spin: 0,
      })
    }

    this.pawOpenMaterial = new THREE.SpriteMaterial({
      map: this.shared.fallbackPawOpenTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.pawGrabMaterial = new THREE.SpriteMaterial({
      map: this.shared.fallbackPawGrabTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.pawPlaceMaterial = new THREE.SpriteMaterial({
      // The generated placement pose replaces this graceful fallback once the
      // asset is loaded.
      map: this.shared.fallbackPawOpenTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const paw = new THREE.Sprite(this.pawOpenMaterial)
    // Anchor the generated paw on its visual centre so the sprite does not
    // introduce a second, asset-relative cursor offset.
    paw.center.set(0.5, 0.5)
    paw.visible = false
    paw.renderOrder = 1000
    this.fxGroup.add(paw)
    this.paw = paw
    this.updatePawScaleFromTexture(this.pawOpenMaterial.map)

    const holdCanvas = document.createElement('canvas')
    holdCanvas.width = 128
    holdCanvas.height = 128
    const holdContext = holdCanvas.getContext('2d')
    if (holdContext) {
      const holdTexture = this.trackTexture(new THREE.CanvasTexture(holdCanvas))
      holdTexture.colorSpace = THREE.SRGBColorSpace
      holdTexture.minFilter = THREE.LinearFilter
      holdTexture.magFilter = THREE.LinearFilter
      const holdMaterial = new THREE.SpriteMaterial({
        map: holdTexture,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
      })
      const holdSprite = new THREE.Sprite(holdMaterial)
      holdSprite.scale.set(0.74, 0.74, 1)
      holdSprite.visible = false
      holdSprite.renderOrder = 1100
      this.fxGroup.add(holdSprite)
      this.holdIndicator = {
        sprite: holdSprite,
        material: holdMaterial,
        texture: holdTexture,
        context: holdContext,
      }
      this.drawHoldIndicator(0)
    }
  }

  private bindEvents(): void {
    if (!this.renderer) return
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointerdown', this.handlePointerDownBound)
    canvas.addEventListener('pointermove', this.handlePointerMoveBound)
    canvas.addEventListener('pointerup', this.handlePointerUpBound)
    canvas.addEventListener('pointercancel', this.handlePointerCancelBound)
    canvas.addEventListener('lostpointercapture', this.handleLostPointerCaptureBound)
    canvas.addEventListener('pointerenter', this.handlePointerEnterBound)
    canvas.addEventListener('pointerleave', this.handlePointerLeaveBound)
    canvas.addEventListener('wheel', this.handleWheelBound, { passive: false })
    window.addEventListener('resize', this.handleResizeBound)
    window.addEventListener('blur', this.handleWindowBlurBound)
    document.addEventListener('visibilitychange', this.handleVisibilityBound)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(this.container)
    }
  }

  private unbindEvents(): void {
    const canvas = this.renderer?.domElement
    canvas?.removeEventListener('pointerdown', this.handlePointerDownBound)
    canvas?.removeEventListener('pointermove', this.handlePointerMoveBound)
    canvas?.removeEventListener('pointerup', this.handlePointerUpBound)
    canvas?.removeEventListener('pointercancel', this.handlePointerCancelBound)
    canvas?.removeEventListener('lostpointercapture', this.handleLostPointerCaptureBound)
    canvas?.removeEventListener('pointerenter', this.handlePointerEnterBound)
    canvas?.removeEventListener('pointerleave', this.handlePointerLeaveBound)
    canvas?.removeEventListener('wheel', this.handleWheelBound)
    window.removeEventListener('resize', this.handleResizeBound)
    window.removeEventListener('blur', this.handleWindowBlurBound)
    document.removeEventListener('visibilitychange', this.handleVisibilityBound)
  }

  private handlePointerEnter(event: PointerEvent): void {
    this.pointerVisible = true
    this.updatePointer(event)
  }

  private handlePointerLeave(): void {
    if (!this.drag && !this.fanPan && !this.fanPinch && !this.pendingCardHold) {
      this.pointerVisible = false
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    this.activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
    })
    this.updatePointer(event)

    if (event.pointerType === 'touch') {
      const touchPointers = [...this.activePointers.entries()].filter(
        ([, pointer]) => pointer.pointerType === 'touch',
      )
      if (
        touchPointers.length >= 2 &&
        !this.fanPinch &&
        this.ready &&
        this.mode === 'fan' &&
        !this.transition &&
        this.snapTweens.size === 0
      ) {
        // A card press remains pending during its hold gesture, so a second
        // finger can begin pinch-to-space without grabbing or resetting it.
        this.cancelPendingCardHold()
        if (this.drag) this.endDrag(false, false)
        event.preventDefault()
        this.startFanPinch([touchPointers[0][0], touchPointers[1][0]])
        return
      }
    }

    if (
      !event.isPrimary ||
      event.button !== 0 ||
      !this.ready ||
      (this.mode !== 'fan' && this.mode !== 'stacked') ||
      this.transition ||
      this.snapTweens.size > 0 ||
      this.drag ||
      this.fanPinch ||
      this.pendingCardHold
    ) {
      return
    }
    event.preventDefault()
    const card = this.pickCard()
    if (!card) {
      if (this.mode === 'fan' && this.fanZoom > 1.001) {
        this.capturePointer(event.pointerId)
        this.fanPan = {
          pointerId: event.pointerId,
          lastPhysicsX: worldToPhysics(this.pointerTableWorld).x,
        }
      }
      return
    }
    if (card.state === 'transitioning') return

    // The pile itself is the fan toggle. A stacked card is never accidentally
    // dragged; only cards already on a spread remain draggable in stacked mode.
    if (this.mode === 'stacked' && card.state === 'stacked') {
      void this.spread()
      return
    }
    if (card.state !== 'fan-anchored' && card.state !== 'slot-locked') return

    this.capturePointer(event.pointerId)
    this.startCardHold(card, event)
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      })
    }
    this.updatePointer(event)
    if (this.fanPinch?.pointerIds.includes(event.pointerId)) {
      event.preventDefault()
      this.updateFanPinch()
      return
    }
    if (this.fanPan?.pointerId === event.pointerId) {
      event.preventDefault()
      const physicsX = worldToPhysics(this.pointerTableWorld).x
      this.setFanViewport(this.fanZoom, this.fanPanX + physicsX - this.fanPan.lastPhysicsX)
      this.fanPan.lastPhysicsX = physicsX
      return
    }
    if (this.pendingCardHold?.pointerId === event.pointerId) {
      event.preventDefault()
      const pending = this.pendingCardHold
      const distance = Math.hypot(
        event.clientX - pending.startClientX,
        event.clientY - pending.startClientY,
      )
      if (performance.now() - pending.startedAt >= pending.durationMs) {
        this.completePendingCardHold(pending)
        if (this.drag) {
          this.drag.rawTarget = worldToPhysics(this.pointerTableWorld)
          this.updateDraggedBodyPose()
          this.updateHighlightedSlot()
        }
        return
      }
      if (distance <= CARD_HOLD_MOVE_THRESHOLD_PX) return

      const shouldPanFan =
        this.mode === 'fan' &&
        this.fanZoom > 1.001 &&
        pending.card.state === 'fan-anchored'
      const currentPhysicsX = worldToPhysics(this.pointerTableWorld).x
      this.cancelPendingCardHold()
      if (shouldPanFan) {
        this.fanPan = {
          pointerId: event.pointerId,
          lastPhysicsX: currentPhysicsX,
        }
        this.setFanViewport(
          this.fanZoom,
          pending.initialPanX + currentPhysicsX - pending.startPhysicsX,
        )
      }
      return
    }
    if (!event.isPrimary) return
    if (this.drag && this.drag.pointerId === event.pointerId) {
      event.preventDefault()
      this.drag.rawTarget = worldToPhysics(this.pointerTableWorld)
      this.updateDraggedBodyPose()
      this.updateHighlightedSlot()
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    this.updatePointer(event)
    if (this.drag?.pointerId === event.pointerId) {
      event.preventDefault()
      this.drag.rawTarget = worldToPhysics(this.pointerTableWorld)
      this.updateDraggedBodyPose()
      this.endDrag(true)
    }
    if (this.fanPan?.pointerId === event.pointerId) this.fanPan = null
    if (this.fanPinch?.pointerIds.includes(event.pointerId)) this.fanPinch = null
    if (this.pendingCardHold?.pointerId === event.pointerId) this.cancelPendingCardHold()
    this.activePointers.delete(event.pointerId)
    this.releasePointer(event.pointerId)
    if (event.pointerType === 'touch' && this.activePointers.size === 0) {
      this.pointerVisible = false
    }
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.endDrag(false)
    if (this.fanPan?.pointerId === event.pointerId) this.fanPan = null
    if (this.fanPinch?.pointerIds.includes(event.pointerId)) this.fanPinch = null
    if (this.pendingCardHold?.pointerId === event.pointerId) this.cancelPendingCardHold()
    this.activePointers.delete(event.pointerId)
    this.releasePointer(event.pointerId)
    if (this.activePointers.size === 0) this.pointerVisible = false
  }

  private handleLostPointerCapture(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) this.endDrag(false)
    if (this.fanPan?.pointerId === event.pointerId) this.fanPan = null
    if (this.fanPinch?.pointerIds.includes(event.pointerId)) this.fanPinch = null
    if (this.pendingCardHold?.pointerId === event.pointerId) this.cancelPendingCardHold()
    this.activePointers.delete(event.pointerId)
  }

  private handleWindowBlur(): void {
    this.pointerVisible = false
    this.endDrag(false)
    this.fanPan = null
    this.fanPinch = null
    this.cancelPendingCardHold()
    this.activePointers.clear()
  }

  private startCardHold(card: CardRuntime, event: PointerEvent): void {
    const physicsPointer = worldToPhysics(this.pointerTableWorld)
    this.pendingCardHold = {
      card,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPhysicsX: physicsPointer.x,
      initialPanX: this.fanPanX,
      startedAt: performance.now(),
      durationMs: this.reducedMotion ? 350 : CARD_HOLD_DURATION_MS,
    }
    if (this.holdIndicator) {
      this.holdIndicator.sprite.visible = false
      this.positionHoldIndicator(card)
    }
    this.emitSnapshot()
  }

  private cancelPendingCardHold(): void {
    if (!this.pendingCardHold && !this.holdIndicator?.sprite.visible) return
    const heldCard = this.pendingCardHold?.card ?? null
    this.pendingCardHold = null
    if (heldCard) this.restoreHeldCardVisual(heldCard)
    if (this.holdIndicator) this.holdIndicator.sprite.visible = false
    this.emitSnapshot()
  }

  private updatePendingCardHold(now: number): void {
    const pending = this.pendingCardHold
    if (!pending) {
      if (this.holdIndicator) this.holdIndicator.sprite.visible = false
      return
    }
    if (
      !this.activePointers.has(pending.pointerId) ||
      (pending.card.state !== 'fan-anchored' && pending.card.state !== 'slot-locked')
    ) {
      this.cancelPendingCardHold()
      return
    }

    const elapsed = now - pending.startedAt
    const progress = clamp(elapsed / pending.durationMs, 0, 1)
    if (this.holdIndicator) {
      const indicatorVisible = elapsed >= CARD_HOLD_INDICATOR_DELAY_MS
      this.holdIndicator.sprite.visible = indicatorVisible
      if (indicatorVisible) {
        const indicatorProgress = clamp(
          (elapsed - CARD_HOLD_INDICATOR_DELAY_MS) /
            (pending.durationMs - CARD_HOLD_INDICATOR_DELAY_MS),
          0,
          1,
        )
        this.drawHoldIndicator(indicatorProgress)
        this.positionHoldIndicator(pending.card)
      }
    }
    if (progress < 1) return
    this.completePendingCardHold(pending)
  }

  private completePendingCardHold(pending: PendingCardHoldRuntime): void {
    if (this.pendingCardHold !== pending) return
    this.pendingCardHold = null
    this.restoreHeldCardVisual(pending.card)
    if (this.holdIndicator) this.holdIndicator.sprite.visible = false
    this.startDrag(pending.card, pending.pointerId)
  }

  private restoreHeldCardVisual(card: CardRuntime): void {
    card.flipGroup.position.x = 0
    card.flipGroup.position.z = 0
    card.flipGroup.rotation.y = 0
  }

  private positionHoldIndicator(card: CardRuntime): void {
    if (!this.holdIndicator) return
    this.holdIndicator.sprite.position.set(
      physicsToWorldX(card.body.position.x),
      0.42,
      physicsToWorldZ(card.body.position.y),
    )
  }

  private drawHoldIndicator(progress: number): void {
    const indicator = this.holdIndicator
    if (!indicator) return
    const context = indicator.context
    const size = indicator.texture.image.width as number
    const center = size / 2
    context.clearRect(0, 0, size, size)
    context.save()
    context.translate(center, center)
    context.lineCap = 'round'
    context.lineWidth = 10
    context.strokeStyle = 'rgba(9, 31, 31, 0.78)'
    context.beginPath()
    context.arc(0, 0, center - 16, 0, Math.PI * 2)
    context.stroke()
    if (progress > 0) {
      context.shadowColor = 'rgba(255, 224, 149, 0.85)'
      context.shadowBlur = 12
      context.strokeStyle = '#f5d58b'
      context.beginPath()
      context.arc(
        0,
        0,
        center - 16,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * clamp(progress, 0, 1),
      )
      context.stroke()
    }
    context.shadowBlur = 0
    context.fillStyle = `rgba(126, 228, 209, ${0.25 + progress * 0.55})`
    context.beginPath()
    context.arc(0, 0, 8 + progress * 5, 0, Math.PI * 2)
    context.fill()
    context.restore()
    indicator.texture.needsUpdate = true
  }

  private handleWheel(event: WheelEvent): void {
    if (!this.canAdjustFanViewport()) return
    event.preventDefault()
    const deltaScale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? Math.max(1, this.container.clientHeight)
          : 1
    const deltaY = event.deltaY * deltaScale
    const nextZoom = this.fanZoom * Math.exp(-deltaY * FAN_WHEEL_SENSITIVITY)
    this.setFanViewport(nextZoom, this.fanPanX)
  }

  private canAdjustFanViewport(): boolean {
    return (
      this.ready &&
      this.mode === 'fan' &&
      !this.transition &&
      this.snapTweens.size === 0 &&
      !this.drag &&
      !this.pendingCardHold
    )
  }

  private capturePointer(pointerId: number): void {
    const canvas = this.renderer?.domElement
    if (!canvas || canvas.hasPointerCapture(pointerId)) return
    try {
      canvas.setPointerCapture(pointerId)
    } catch {
      // A browser may retire a touch pointer between events; cleanup handlers
      // still clear the gesture state in that case.
    }
  }

  private releasePointer(pointerId: number): void {
    const canvas = this.renderer?.domElement
    if (!canvas?.hasPointerCapture(pointerId)) return
    try {
      canvas.releasePointerCapture(pointerId)
    } catch {
      // Pointer capture was already released by the browser.
    }
  }

  private startFanPinch(pointerIds: [number, number]): void {
    const first = this.activePointers.get(pointerIds[0])
    const second = this.activePointers.get(pointerIds[1])
    if (!first || !second) return
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
    if (distance < 1) return
    this.fanPan = null
    this.capturePointer(pointerIds[0])
    this.capturePointer(pointerIds[1])
    this.fanPinch = {
      pointerIds,
      initialDistance: distance,
      initialZoom: this.fanZoom,
    }
  }

  private updateFanPinch(): void {
    const pinch = this.fanPinch
    if (!pinch) return
    const first = this.activePointers.get(pinch.pointerIds[0])
    const second = this.activePointers.get(pinch.pointerIds[1])
    if (!first || !second) {
      this.fanPinch = null
      return
    }
    const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
    this.setFanViewport(pinch.initialZoom * (distance / pinch.initialDistance), this.fanPanX)
  }

  private setFanViewport(zoom: number, panX: number, excludedCard?: CardRuntime): void {
    this.fanZoom = clampFanSpacingZoom(zoom)
    const panRange = getFanPanRange(
      this.cards.map((card) => card.homePose.x),
      FAN_CENTER.x,
      this.fanZoom,
      FAN_VIEWPORT_CENTER_WIDTH,
    )
    this.fanPanX = clamp(panX, panRange.min, panRange.max)
    this.applyFanViewport(excludedCard)
  }

  private applyFanViewport(excludedCard?: CardRuntime): void {
    for (const card of this.cards) {
      if (card === excludedCard || card.state !== 'fan-anchored') continue
      Matter.Body.setPosition(card.body, {
        x: transformFanX(card.homePose.x, FAN_CENTER.x, this.fanZoom, this.fanPanX),
        y: card.homePose.y,
      })
      Matter.Body.setAngle(card.body, card.homePose.angle)
      Matter.Body.setVelocity(card.body, { x: 0, y: 0 })
      Matter.Body.setAngularVelocity(card.body, 0)
    }
  }

  private resetFanState(): void {
    const initial = resetFanViewport()
    this.fanZoom = initial.zoom
    this.fanPanX = initial.panX
    this.fanPan = null
    this.fanPinch = null
  }

  private updatePointer(event: PointerEvent): void {
    if (!this.renderer || !this.camera) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    this.pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersection = this.raycaster.ray.intersectPlane(tablePlane, this.pointerTableWorld)
    if (intersection) {
      const now = performance.now()
      const elapsed = Math.max(1, now - this.lastPointerAt)
      this.pointerVelocityX = ((event.clientX - this.lastPointerClientX) / elapsed) * 1000
      this.lastPointerClientX = event.clientX
      this.lastPointerAt = now
      this.pointerVisible = true
    }
  }

  private pickCard(): CardRuntime | null {
    const meshes = this.cards.flatMap((card) => card.pickMeshes)
    const intersections = this.raycaster.intersectObjects(meshes, false)
    for (const intersection of intersections) {
      const cardId = intersection.object.userData.cardId as string | undefined
      const card = cardId ? this.cards.find((candidate) => candidate.data.id === cardId) : undefined
      if (card && card.state !== 'transitioning') return card
    }
    return null
  }

  private startDrag(card: CardRuntime, pointerId: number): void {
    if (!this.engine) return
    const pointer = worldToPhysics(this.pointerTableWorld)
    const originState = card.state
    const originPlacement =
      originState === 'slot-locked'
        ? ([...this.placedBySlot.values()].find((placed) => placed.card === card) ?? null)
        : null
    const grabOffset = Matter.Vector.rotate(
      Matter.Vector.sub(pointer, card.body.position),
      -card.body.angle,
    )
    if (originPlacement) this.placedBySlot.delete(originPlacement.slot.id)

    Matter.Body.setStatic(card.body, true)
    Matter.Body.setVelocity(card.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(card.body, 0)
    card.state = 'dragged'
    card.body.collisionFilter.category = COLLISION.dragged
    card.body.collisionFilter.mask = 0
    this.resetCardVisual(card)
    this.setCardFace(card, originPlacement?.revealed === true, true)
    this.forceCardVisualLift(card, DRAG_LIFT)
    this.setCardRenderOrder(card, 900)
    this.drag = {
      card,
      pointerId,
      rawTarget: { ...pointer },
      grabOffset,
      originState,
      originPlacement,
    }
    this.updateDraggedBodyPose()
    this.highlightedSlotId = null
    this.emitSnapshot()
    this.options.onEvent?.({
      type: 'dragstart',
      cardId: card.data.id,
      snapshot: this.getSnapshot(),
    })
  }

  private endDrag(allowSlotLock: boolean, releaseCapture = true): void {
    const drag = this.drag
    if (!drag) return
    const cardId = drag.card.data.id
    const hit = allowSlotLock
      ? this.findSlotAtPoint(drag.rawTarget) ?? this.findSlotAtPoint(drag.card.body.position)
      : null
    this.drag = null
    const canvas = this.renderer?.domElement
    if (releaseCapture && canvas?.hasPointerCapture(drag.pointerId)) {
      canvas.releasePointerCapture(drag.pointerId)
    }
    this.setHighlightedSlot(null)
    if (hit) {
      this.startSlotSnap(
        drag.card,
        hit.slot,
        hit.pose,
        drag.originPlacement?.revealed ?? false,
      )
    } else if (!allowSlotLock && drag.originPlacement) {
      const pose = this.getCurrentSlotPoses().find(
        (candidate) => candidate.slot.id === drag.originPlacement?.slot.id,
      )
      if (pose) {
        this.lockCardImmediately(
          drag.card,
          drag.originPlacement.slot,
          pose,
          drag.originPlacement.revealed,
        )
      } else {
        this.stackCard(drag.card)
      }
    } else if (drag.originPlacement) {
      // When an incomplete spread is still open, recovering a placed card puts
      // it back into the current (possibly zoomed/panned) fan. A completed,
      // collapsed reading still returns it to the physical pile.
      if (this.mode === 'fan') {
        this.anchorCard(drag.card)
      } else {
        this.loosenCard(drag.card)
        void this.collapseUnlockedCards()
      }
    } else if (drag.originState === 'fan-anchored' || this.mode === 'fan') {
      this.anchorCard(drag.card)
    } else {
      this.stackCard(drag.card)
    }
    this.emitSnapshot()
    this.options.onEvent?.({ type: 'dragend', cardId, snapshot: this.getSnapshot() })
  }

  private findSlotAtPoint(point: Point2D) {
    return findSpreadSlotAtPoint(
      point,
      this.currentSpread,
      this.getSpreadGeometry(),
      {
        padding: CARD_WIDTH * 0.36,
        occupiedSlotIds: [...this.placedBySlot.keys()],
        preferredOrder: this.placedBySlot.size + 1,
      },
    )
  }

  private updateHighlightedSlot(): void {
    if (!this.drag) return this.setHighlightedSlot(null)
    this.setHighlightedSlot(
      (
        this.findSlotAtPoint(this.drag.rawTarget) ??
        this.findSlotAtPoint(this.drag.card.body.position)
      )?.slot.id ?? null,
    )
  }

  private setHighlightedSlot(slotId: string | null): void {
    if (this.highlightedSlotId === slotId) return
    this.highlightedSlotId = slotId
    for (const [id, visual] of this.slotVisuals) {
      const highlighted = id === slotId
      visual.material.opacity = highlighted ? 0.82 : 0.36
      visual.material.color.setHex(highlighted ? 0xffedaf : 0xd9c48e)
      visual.root.scale.setScalar(highlighted ? 1.055 : 1)
    }
    this.emitSnapshot()
  }

  private startSlotSnap(
    card: CardRuntime,
    slot: TarotSpreadSlot,
    pose: SpreadSlotPose,
    revealed = false,
  ): void {
    Matter.Body.setStatic(card.body, true)
    card.body.collisionFilter.category = COLLISION.locked
    card.body.collisionFilter.mask = 0
    card.state = 'slot-locked'
    card.root.visible = true
    card.root.scale.set(1, 1, 1)
    for (const mesh of card.pickMeshes) mesh.visible = true
    this.setCardFace(card, revealed, true)
    this.setCardRenderOrder(card, 500)
    const target: CardPose = {
      x: pose.x,
      y: pose.y,
      angle: (pose.rotationDeg * Math.PI) / 180,
      zIndex: 200 + pose.layer,
    }
    const tween: SnapTween = {
      card,
      slot,
      pose,
      startedAt: performance.now(),
      durationMs: this.reducedMotion ? 90 : 230,
      from: this.currentPose(card),
      to: target,
    }
    this.snapTweens.set(card.data.id, tween)
    this.placedBySlot.set(slot.id, { card, slot, revealed })
    this.pawPlacement = {
      card,
      target: { x: pose.x, y: pose.y },
      startedAt: performance.now(),
      durationMs: this.reducedMotion ? 180 : PAW_PLACE_DURATION_MS,
    }
    void this.ensureFrontTexture(card)
    this.emitSnapshot()
  }

  private updateSnapTweens(now: number): void {
    if (this.snapTweens.size === 0) return
    for (const [cardId, tween] of [...this.snapTweens]) {
      const raw = clamp((now - tween.startedAt) / tween.durationMs, 0, 1)
      const progress = easeOutCubic(raw)
      Matter.Body.setPosition(tween.card.body, {
        x: lerp(tween.from.x, tween.to.x, progress),
        y: lerp(tween.from.y, tween.to.y, progress),
      })
      Matter.Body.setAngle(
        tween.card.body,
        tween.from.angle + shortestAngleDelta(tween.from.angle, tween.to.angle) * progress,
      )
      tween.card.transitionLift = Math.sin(raw * Math.PI) * 0.16
      if (raw < 1) continue
      tween.card.transitionLift = 0
      Matter.Body.setPosition(tween.card.body, { x: tween.to.x, y: tween.to.y })
      Matter.Body.setAngle(tween.card.body, tween.to.angle)
      Matter.Body.setVelocity(tween.card.body, { x: 0, y: 0 })
      Matter.Body.setAngularVelocity(tween.card.body, 0)
      tween.card.state = 'slot-locked'
      tween.card.body.collisionFilter.mask = 0
      this.resetCardVisual(tween.card)
      const placement = this.placedBySlot.get(tween.slot.id)
      this.setCardFace(tween.card, placement?.revealed === true, true)
      this.forceCardVisualLift(tween.card, LOCKED_CARD_LIFT)
      this.setCardRenderOrder(tween.card, 500)
      this.snapTweens.delete(cardId)
      this.emitSnapshot()
      this.options.onEvent?.({
        type: 'cardlocked',
        cardId,
        slotId: tween.slot.id,
        spreadId: this.currentSpread.id,
        snapshot: this.getSnapshot(),
      })
      const spreadComplete =
        this.currentSpread.slots.length > 0 &&
        this.currentSpread.slots.every((slot) => this.placedBySlot.has(slot.id))
      if (this.snapTweens.size === 0 && this.mode === 'fan' && spreadComplete) {
        void this.collapseUnlockedCards()
      }
    }
  }

  private lockCardImmediately(
    card: CardRuntime,
    slot: TarotSpreadSlot,
    pose: SpreadSlotPose,
    revealed: boolean,
  ): void {
    Matter.Body.setStatic(card.body, true)
    Matter.Body.setPosition(card.body, { x: pose.x, y: pose.y })
    Matter.Body.setAngle(card.body, (pose.rotationDeg * Math.PI) / 180)
    Matter.Body.setVelocity(card.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(card.body, 0)
    card.body.collisionFilter.category = COLLISION.locked
    card.body.collisionFilter.mask = 0
    card.state = 'slot-locked'
    this.placedBySlot.set(slot.id, { card, slot, revealed })
    this.resetCardVisual(card)
    this.setCardFace(card, revealed, true)
    this.forceCardVisualLift(card, LOCKED_CARD_LIFT)
    this.setCardRenderOrder(card, 500)
  }

  private updateDraggedBodyPose(): void {
    const drag = this.drag
    if (!drag) return
    const rotatedOffset = Matter.Vector.rotate(drag.grabOffset, drag.card.body.angle)
    Matter.Body.setPosition(drag.card.body, {
      x: drag.rawTarget.x - rotatedOffset.x,
      y: drag.rawTarget.y - rotatedOffset.y,
    })
    Matter.Body.setVelocity(drag.card.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(drag.card.body, 0)
  }

  private setCardRenderOrder(card: CardRuntime, order: number): void {
    card.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.renderOrder = order
    })
  }

  private forceCardVisualLift(card: CardRuntime, lift: number): void {
    card.visualLift = lift
    const layer = this.visualLayer(card) * 0.00017
    card.root.position.set(
      physicsToWorldX(card.body.position.x),
      CARD_THICKNESS / 2 + lift + layer,
      physicsToWorldZ(card.body.position.y),
    )
  }

  private beginTransition(
    kind: ActiveTransition['kind'],
    cards: CardRuntime[],
    targets: Map<string, CardPose>,
    onFinish: () => void,
  ): Promise<boolean> {
    const baseTravelMs = this.reducedMotion ? 130 : kind === 'repair' ? 650 : 760
    const staggerMs = this.reducedMotion ? 0 : kind === 'repair' ? 3.2 : 5.4
    const entries = cards.map((card, index): TransitionEntry => {
      const from = this.currentPose(card)
      const to = targets.get(card.data.id) ?? from
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      const perpendicularX = distance > 0 ? -(to.y - from.y) / distance : 0
      const perpendicularY = distance > 0 ? (to.x - from.x) / distance : 0
      const side = index % 2 === 0 ? 1 : -1
      const bend = Math.min(110, distance * 0.16) * side
      card.state = 'transitioning'
      card.root.visible = true
      card.body.collisionFilter.mask = 0
      Matter.Body.setStatic(card.body, true)
      Matter.Body.setVelocity(card.body, { x: 0, y: 0 })
      Matter.Body.setAngularVelocity(card.body, 0)
      card.flipTarget = 0
      return {
        card,
        from,
        to,
        control: {
          x: (from.x + to.x) / 2 + perpendicularX * bend,
          y: (from.y + to.y) / 2 + perpendicularY * bend - Math.min(90, distance * 0.1),
        },
        delayMs: index * staggerMs,
        travelMs: baseTravelMs,
      }
    })
    const totalMs = entries.reduce(
      (maximum, entry) => Math.max(maximum, entry.delayMs + entry.travelMs),
      0,
    )

    return new Promise((resolve) => {
      this.transition = {
        kind,
        startedAt: performance.now(),
        entries,
        totalMs,
        resolve: (completed) => {
          if (completed) onFinish()
          resolve(completed)
        },
      }
      this.emitSnapshot()
    })
  }

  private updateTransition(now: number): void {
    const transition = this.transition
    if (!transition) return
    const elapsed = now - transition.startedAt
    for (const entry of transition.entries) {
      const raw = clamp((elapsed - entry.delayMs) / entry.travelMs, 0, 1)
      const progress = easeInOutCubic(raw)
      Matter.Body.setPosition(entry.card.body, {
        x: quadraticBezier(entry.from.x, entry.control.x, entry.to.x, progress),
        y: quadraticBezier(entry.from.y, entry.control.y, entry.to.y, progress),
      })
      Matter.Body.setAngle(
        entry.card.body,
        entry.from.angle + shortestAngleDelta(entry.from.angle, entry.to.angle) * progress,
      )
      entry.card.transitionLift = Math.sin(raw * Math.PI) * (transition.kind === 'repair' ? 0.22 : 0.29)
    }
    if (elapsed < transition.totalMs) return

    for (const entry of transition.entries) {
      Matter.Body.setPosition(entry.card.body, { x: entry.to.x, y: entry.to.y })
      Matter.Body.setAngle(entry.card.body, entry.to.angle)
      entry.card.transitionLift = 0
    }
    this.transition = null
    transition.resolve(true)
  }

  private frame(time: number): void {
    if (this.destroyed || !this.mounted) return
    const elapsed = clamp(time - this.lastFrameAt, 0, 50)
    this.lastFrameAt = time
    if (!document.hidden) {
      this.updatePendingCardHold(time)
      this.updateTransition(time)
      this.updateSnapTweens(time)
      this.accumulatorMs += elapsed
      let subSteps = 0
      while (this.accumulatorMs >= FIXED_STEP_MS && subSteps < MAX_SUB_STEPS) {
        this.simulate(FIXED_STEP_MS)
        this.accumulatorMs -= FIXED_STEP_MS
        subSteps += 1
      }
      if (subSteps === MAX_SUB_STEPS) this.accumulatorMs = 0
      const deltaSeconds = elapsed / 1000
      this.updateCardVisuals(deltaSeconds)
      this.updatePaw(deltaSeconds)
      this.updateEffects(deltaSeconds)
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }
    }
    this.animationFrame = requestAnimationFrame((nextTime) => this.frame(nextTime))
  }

  private simulate(stepMs: number): void {
    if (!this.engine) return
    this.updateDraggedBodyPose()
    Matter.Engine.update(this.engine, stepMs)
  }

  private updateCardVisuals(deltaSeconds: number): void {
    const smoothing = 1 - Math.exp(-18 * deltaSeconds)
    const heldCard = this.pendingCardHold?.card ?? null
    const holdElapsed = this.pendingCardHold
      ? Math.max(0, performance.now() - this.pendingCardHold.startedAt)
      : 0
    for (const card of this.cards) {
      const liftTarget =
        (card.state === 'dragged'
          ? DRAG_LIFT
          : card.state === 'slot-locked'
            ? LOCKED_CARD_LIFT
            : 0) +
        card.transitionLift
      card.visualLift = lerp(card.visualLift, liftTarget, smoothing || 1)
      const layer = this.visualLayer(card) * 0.00017
      card.root.position.set(
        physicsToWorldX(card.body.position.x),
        CARD_THICKNESS / 2 + card.visualLift + layer,
        physicsToWorldZ(card.body.position.y),
      )
      card.root.rotation.y = -card.body.angle

      if (card === heldCard) {
        // This is a visual-only local offset. Matter coordinates and the
        // canonical root transform stay untouched, so slot targeting cannot
        // drift and every frame is derived from the same origin.
        const strength = easeOutCubic(clamp(holdElapsed / 90, 0, 1))
        const phase = holdElapsed * 0.049
        card.flipGroup.position.x = Math.sin(phase) * 0.011 * strength
        card.flipGroup.position.z = Math.sin(phase * 1.37 + 0.8) * 0.006 * strength
        card.flipGroup.rotation.y = Math.sin(phase * 0.83 + 0.35) * 0.0045 * strength
      } else if (
        card.flipGroup.position.x !== 0 ||
        card.flipGroup.position.z !== 0 ||
        card.flipGroup.rotation.y !== 0
      ) {
        this.restoreHeldCardVisual(card)
      }

      const flipDuration = this.reducedMotion ? 0.12 : 0.52
      if (card.flipProgress !== card.flipTarget && deltaSeconds > 0) {
        const direction = Math.sign(card.flipTarget - card.flipProgress)
        card.flipProgress = clamp(
          card.flipProgress + direction * (deltaSeconds / flipDuration),
          0,
          1,
        )
      }
      card.flipGroup.rotation.x = card.flipProgress * Math.PI
    }
  }

  private visualLayer(card: CardRuntime): number {
    if (card.state === 'stacked') return card.stackPose.zIndex
    if (card.state === 'dragged') return 420
    if (card.state === 'slot-locked') {
      const placed = [...this.placedBySlot.values()].find((entry) => entry.card === card)
      return 320 + (placed?.slot.layer ?? placed?.slot.order ?? 0)
    }
    if (card.state === 'loose') return 120 + card.homePose.zIndex
    return card.homePose.zIndex
  }

  private updatePaw(deltaSeconds: number): void {
    if (
      !this.paw ||
      !this.pawOpenMaterial ||
      !this.pawGrabMaterial ||
      !this.pawPlaceMaterial
    ) {
      return
    }
    const now = performance.now()
    if (
      this.pawPlacement &&
      now - this.pawPlacement.startedAt >= this.pawPlacement.durationMs
    ) {
      this.pawPlacement = null
    }
    const placement = this.pawPlacement
    const targetMaterial = placement
      ? this.pawPlaceMaterial
      : this.drag
        ? this.pawGrabMaterial
        : this.pawOpenMaterial
    if (this.paw.material !== targetMaterial) {
      this.paw.material = targetMaterial
      this.updatePawScaleFromTexture(targetMaterial.map)
    }
    const opacityTarget = this.pointerVisible || placement ? 0.98 : 0
    const fade = 1 - Math.exp(-14 * deltaSeconds)
    this.pawOpenMaterial.opacity = lerp(this.pawOpenMaterial.opacity, opacityTarget, fade)
    this.pawGrabMaterial.opacity = lerp(this.pawGrabMaterial.opacity, opacityTarget, fade)
    this.pawPlaceMaterial.opacity = lerp(this.pawPlaceMaterial.opacity, opacityTarget, fade)
    this.paw.visible =
      this.pointerVisible ||
      placement !== null ||
      this.pawOpenMaterial.opacity > 0.01 ||
      this.pawGrabMaterial.opacity > 0.01 ||
      this.pawPlaceMaterial.opacity > 0.01
    const target = placement
      ? new THREE.Vector3(
          physicsToWorldX(placement.target.x),
          0,
          physicsToWorldZ(placement.target.y),
        )
      : this.pointerTableWorld.clone()
    // Keep x exactly aligned with the cursor/grab point. A small table-depth
    // and height separation preserves the paw's readable layer without the
    // conspicuous camera-right drift that previously moved it beside the card.
    target.z += placement ? 0.025 : this.drag ? 0.02 : 0.008
    target.y += placement ? 0.08 : this.drag ? 0.1 : 0.01
    const follow = 1 - Math.exp(-(placement ? 38 : this.drag ? 34 : 22) * deltaSeconds)
    this.paw.position.lerp(target, follow)
    if (placement) {
      const progress = clamp(
        (now - placement.startedAt) / placement.durationMs,
        0,
        1,
      )
      this.updatePawScaleFromTexture(targetMaterial.map, 1 + Math.sin(progress * Math.PI) * 0.12)
      this.paw.position.y += Math.sin(progress * Math.PI) * 0.055
      targetMaterial.rotation = 0
    } else {
      targetMaterial.rotation = clamp(-this.pointerVelocityX * 0.00015, -0.21, 0.21)
    }
  }

  private updatePawScaleFromTexture(texture: THREE.Texture | null, scale = 1): void {
    if (!this.paw) return
    const image = texture?.image as
      | {
          naturalWidth?: number
          naturalHeight?: number
          videoWidth?: number
          videoHeight?: number
          width?: number
          height?: number
        }
      | undefined
    const width = image?.naturalWidth ?? image?.videoWidth ?? image?.width ?? 0
    const height = image?.naturalHeight ?? image?.videoHeight ?? image?.height ?? 0
    const sourceAspect = width > 0 && height > 0 ? width / height : PAW_FALLBACK_ASPECT
    const aspect = clamp(sourceAspect, 0.46, 0.76)
    this.paw.scale.set(PAW_WORLD_HEIGHT * aspect * scale, PAW_WORLD_HEIGHT * scale, 1)
  }

  private startMagic(center: Point2D, duration: number): void {
    if (!this.magicRing) return
    this.magicRing.age = 0
    this.magicRing.duration = duration
    this.magicRing.root.visible = true
    this.magicRing.root.position.set(physicsToWorldX(center.x), 0.035, physicsToWorldZ(center.y))
    this.magicRing.root.scale.setScalar(0.45)

    for (const particle of this.particles) {
      const angle = this.random() * Math.PI * 2
      const radius = 0.3 + this.random() * 2.25
      particle.age = -this.random() * duration * 0.32
      particle.duration = duration * (0.5 + this.random() * 0.45)
      particle.spin = (this.random() - 0.5) * 4
      particle.sprite.position.set(
        physicsToWorldX(center.x) + Math.cos(angle) * radius,
        0.08 + this.random() * 0.46,
        physicsToWorldZ(center.y) + Math.sin(angle) * radius * 0.52,
      )
      particle.velocity.set(
        -Math.cos(angle) * (0.25 + this.random() * 0.45),
        0.3 + this.random() * 0.85,
        -Math.sin(angle) * (0.16 + this.random() * 0.36),
      )
      particle.sprite.scale.setScalar(0.15 + this.random() * 0.24)
      particle.sprite.visible = true
    }
  }

  private updateEffects(deltaSeconds: number): void {
    if (this.magicRing?.root.visible) {
      this.magicRing.age += deltaSeconds
      const progress = clamp(this.magicRing.age / this.magicRing.duration, 0, 1)
      this.magicRing.root.scale.setScalar(lerp(0.45, 1.8, easeOutCubic(progress)))
      this.magicRing.root.rotation.y += deltaSeconds * 1.7
      this.magicRing.material.opacity = Math.sin(progress * Math.PI) * 0.78
      if (progress >= 1) this.magicRing.root.visible = false
    }
    for (const particle of this.particles) {
      if (!particle.sprite.visible) continue
      particle.age += deltaSeconds
      if (particle.age < 0) {
        ;(particle.sprite.material as THREE.SpriteMaterial).opacity = 0
        continue
      }
      const progress = clamp(particle.age / particle.duration, 0, 1)
      particle.sprite.position.addScaledVector(particle.velocity, deltaSeconds)
      particle.velocity.y -= deltaSeconds * 0.62
      const material = particle.sprite.material as THREE.SpriteMaterial
      material.opacity = Math.sin(progress * Math.PI) * 0.92
      material.rotation += particle.spin * deltaSeconds
      if (progress >= 1) particle.sprite.visible = false
    }
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    const aspect = width / height
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxPixelRatio))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = aspect
    const distanceScale = aspect < 1.42 ? 1.42 / Math.max(0.58, aspect) : 1
    this.camera.position.set(0, 7.5 * distanceScale, 7.2 * distanceScale)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld(true)

    const farLeft = new THREE.Vector3(
      -(TABLE_WIDTH * WORLD_SCALE) / 2,
      0,
      -(TABLE_HEIGHT * WORLD_SCALE) / 2,
    ).project(this.camera)
    const farRight = new THREE.Vector3(
      (TABLE_WIDTH * WORLD_SCALE) / 2,
      0,
      -(TABLE_HEIGHT * WORLD_SCALE) / 2,
    ).project(this.camera)
    const tableTop = clamp(((1 - farLeft.y) / 2) * height, 0, height)
    const projectedLeft = ((farLeft.x + 1) / 2) * width
    const projectedRight = ((farRight.x + 1) / 2) * width
    const tableSideInset = Math.max(
      0,
      Math.min(projectedLeft, width - projectedRight),
    )
    const tableStage = this.container.closest<HTMLElement>('.tarot-table-stage')
    tableStage?.style.setProperty('--tarot-table-top', `${tableTop.toFixed(2)}px`)
    tableStage?.style.setProperty(
      '--tarot-table-side-inset',
      `${tableSideInset.toFixed(2)}px`,
    )
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.pointerVisible = false
      this.endDrag(false)
      this.fanPan = null
      this.fanPinch = null
      this.cancelPendingCardHold()
      this.activePointers.clear()
    }
    this.lastFrameAt = performance.now()
    this.accumulatorMs = 0
  }

  private getFanPose(card: CardRuntime): CardPose {
    return {
      ...card.homePose,
      x: transformFanX(card.homePose.x, FAN_CENTER.x, this.fanZoom, this.fanPanX),
    }
  }

  private anchorCard(card: CardRuntime): void {
    const pose = this.getFanPose(card)
    Matter.Body.setStatic(card.body, true)
    Matter.Body.setPosition(card.body, { x: pose.x, y: pose.y })
    Matter.Body.setAngle(card.body, pose.angle)
    Matter.Body.setVelocity(card.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(card.body, 0)
    card.body.collisionFilter.category = COLLISION.anchored
    card.body.collisionFilter.mask = 0
    card.state = 'fan-anchored'
    this.resetCardVisual(card)
    this.setCardRenderOrder(card, card.homePose.zIndex)
  }

  private stackCard(card: CardRuntime): void {
    Matter.Body.setStatic(card.body, true)
    Matter.Body.setPosition(card.body, { x: card.stackPose.x, y: card.stackPose.y })
    Matter.Body.setAngle(card.body, card.stackPose.angle)
    Matter.Body.setVelocity(card.body, { x: 0, y: 0 })
    Matter.Body.setAngularVelocity(card.body, 0)
    card.body.collisionFilter.category = COLLISION.anchored
    card.body.collisionFilter.mask = 0
    card.state = 'stacked'
    this.resetCardVisual(card)
    this.setCardRenderOrder(card, card.stackPose.zIndex)
  }

  private loosenCard(card: CardRuntime): void {
    Matter.Body.setStatic(card.body, true)
    card.body.collisionFilter.category = COLLISION.loose
    card.body.collisionFilter.mask = 0
    card.state = 'loose'
    card.transitionLift = 0
  }

  private resetCardVisual(card: CardRuntime): void {
    card.root.visible = true
    card.root.scale.set(1, 1, 1)
    card.root.rotation.set(0, -card.body.angle, 0)
    card.flipGroup.visible = true
    card.flipGroup.position.set(0, 0, 0)
    card.flipGroup.rotation.set(0, 0, 0)
    card.flipGroup.scale.set(1, 1, 1)
    for (const mesh of card.pickMeshes) mesh.visible = true
    card.visualLift = 0
    card.transitionLift = 0
    card.flipProgress = 0
    card.flipTarget = 0
    const layer = this.visualLayer(card) * 0.00017
    card.root.position.set(
      physicsToWorldX(card.body.position.x),
      CARD_THICKNESS / 2 + layer,
      physicsToWorldZ(card.body.position.y),
    )
  }

  private setCardFace(card: CardRuntime, faceUp: boolean, immediate = false): void {
    const target = faceUp ? 1 : 0
    card.flipTarget = target
    if (!immediate) return
    card.flipProgress = target
    card.flipGroup.rotation.x = target * Math.PI
  }

  private releasePlacedCards(): CardRuntime[] {
    const releasedCards: CardRuntime[] = []
    for (const placed of this.placedBySlot.values()) {
      placed.card.flipTarget = 0
      this.loosenCard(placed.card)
      releasedCards.push(placed.card)
    }
    this.placedBySlot.clear()
    return releasedCards
  }

  private currentPose(card: CardRuntime): CardPose {
    return {
      x: card.body.position.x,
      y: card.body.position.y,
      angle: card.body.angle,
      zIndex: this.visualLayer(card),
    }
  }

  private getSpreadGeometry() {
    return {
      origin: SPREAD_ORIGIN,
      tableSize: SPREAD_TABLE_SIZE,
      cardSize: { width: CARD_WIDTH, height: CARD_HEIGHT },
    }
  }

  private getCurrentSlotPoses(): SpreadSlotPose[] {
    return getSpreadSlotPoses(this.currentSpread, this.getSpreadGeometry())
  }

  private setMode(mode: TarotSceneMode): void {
    if (this.mode === mode) return
    this.mode = mode
    this.emitSnapshot()
    this.options.onEvent?.({ type: 'modechange', mode, snapshot: this.getSnapshot() })
  }

  private emitSnapshot(): void {
    if (this.listeners.size === 0) return
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }

  private trackTexture<T extends THREE.Texture>(texture: T): T {
    this.ownedTextures.add(texture)
    return texture
  }

  private async loadGeneratedTextures(): Promise<void> {
    if (!this.shared) return
    const loader = new THREE.TextureLoader()
    const replacements = await Promise.all([
      loadTextureInto(loader, this.assets.table),
      loadTextureInto(loader, this.assets.cardBack),
      loadTextureInto(loader, this.assets.slotFrame),
      loadTextureInto(loader, this.assets.magicParticle),
      loadTextureInto(loader, this.assets.magicRing),
      loadTextureInto(loader, this.assets.pawOpen),
      loadTextureInto(loader, this.assets.pawGrab),
      loadTextureInto(loader, this.assets.pawPlace),
    ])
    if (this.destroyed) {
      for (const texture of replacements) texture?.dispose()
      return
    }
    const [table, cardBack, slot, particle, ring, pawOpen, pawGrab, pawPlace] = replacements
    if (table && this.tableMaterial) {
      this.trackTexture(table)
      this.tableMaterial.map = table
      this.tableMaterial.needsUpdate = true
    }
    if (cardBack && this.shared) {
      this.trackTexture(cardBack)
      this.shared.backMaterial.map = cardBack
      this.shared.backMaterial.needsUpdate = true
    }
    if (slot) {
      this.trackTexture(slot)
      this.resolvedSlotTexture = slot
      for (const { material } of this.slotVisuals.values()) {
        material.map = slot
        material.needsUpdate = true
      }
    }
    if (particle) {
      this.trackTexture(particle)
      for (const runtime of this.particles) {
        const material = runtime.sprite.material as THREE.SpriteMaterial
        material.map = particle
        material.needsUpdate = true
      }
    }
    if (ring && this.magicRing) {
      this.trackTexture(ring)
      this.magicRing.material.map = ring
      this.magicRing.material.needsUpdate = true
    }
    if (pawOpen && this.pawOpenMaterial) {
      this.trackTexture(pawOpen)
      this.pawOpenMaterial.map = pawOpen
      this.pawOpenMaterial.needsUpdate = true
      if (this.paw?.material === this.pawOpenMaterial) this.updatePawScaleFromTexture(pawOpen)
    }
    if (pawGrab && this.pawGrabMaterial) {
      this.trackTexture(pawGrab)
      this.pawGrabMaterial.map = pawGrab
      this.pawGrabMaterial.needsUpdate = true
      if (this.paw?.material === this.pawGrabMaterial) this.updatePawScaleFromTexture(pawGrab)
    }
    if (pawPlace && this.pawPlaceMaterial) {
      this.trackTexture(pawPlace)
      this.pawPlaceMaterial.map = pawPlace
      this.pawPlaceMaterial.needsUpdate = true
      if (this.paw?.material === this.pawPlaceMaterial) {
        this.updatePawScaleFromTexture(pawPlace)
      }
    }
  }

  private async ensureFrontTexture(card: CardRuntime): Promise<void> {
    if (card.frontLoadPromise) return card.frontLoadPromise
    if (this.destroyed) return
    card.frontLoadStarted = true
    card.frontLoadPromise = (async () => {
      const loader = new THREE.TextureLoader()
      const texture = await loadTextureInto(loader, card.data.frontTextureUrl)
      if (!texture) return
      if (this.destroyed) {
        texture.dispose()
        return
      }
      this.trackTexture(texture)
      card.frontMaterial.map = texture
      card.frontMaterial.needsUpdate = true
    })()
    return card.frontLoadPromise
  }
}

export function mountTarotScene(
  container: HTMLElement,
  options: TarotSceneOptions = {},
): TarotScene {
  return new TarotScene(container, options).mount()
}
