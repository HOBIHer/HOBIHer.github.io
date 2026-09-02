import type { Point2D, Size2D, TarotSpread, TarotSpreadSlot } from './types'

export interface TarotCardLayout<T> {
  card: T
  index: number
  x: number
  y: number
  rotationDeg: number
  zIndex: number
}

export interface StackLayoutOptions {
  center: Point2D
  offset?: Point2D
  baseRotationDeg?: number
  rotationStepDeg?: number
  maxVisibleLayers?: number
  startZIndex?: number
}

export interface FanLayoutOptions {
  center: Point2D
  radius: number
  arcDeg?: number
  rotationDeg?: number
  startZIndex?: number
}

export interface FanViewportState {
  zoom: number
  panX: number
}

export interface FanPanRange {
  min: number
  max: number
}

export interface TarotViewportComposition {
  distanceScale: number
  lookAtY: number
  useCompactTableLayout: boolean
}

export const FAN_SPACING_ZOOM_MIN = 1
export const FAN_SPACING_ZOOM_MAX = 3.6

const TABLE_FIT_ASPECT = 1.42
const TABLE_FIT_MIN_ASPECT = 0.58
const PHONE_LAYOUT_MAX_WIDTH = 720
const PHONE_LAYOUT_MAX_ASPECT = 0.72
const PHONE_CAMERA_DISTANCE_SCALE = 1.85
const DEFAULT_CAMERA_LOOK_AT_Y = 0.55
const PHONE_CAMERA_LOOK_AT_Y = 1.35

export interface SpreadSlotGeometry {
  tableSize: Size2D
  cardSize: Size2D
  origin?: Point2D
}

export interface SpreadSlotPose {
  slot: TarotSpreadSlot
  x: number
  y: number
  width: number
  height: number
  rotationDeg: number
  layer: number
}

export interface SpreadSlotHit {
  slot: TarotSpreadSlot
  pose: SpreadSlotPose
  distanceSquared: number
}

export interface SpreadSlotHitOptions {
  padding?: number
  occupiedSlotIds?: readonly string[]
  allowedSlotIds?: readonly string[]
  preferredOrder?: number
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback
}

function rotatePoint(point: Point2D, rotationDeg: number): Point2D {
  const radians = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

/**
 * Frame the fixed 16:9 tabletop for the current stage. Tall phone screens use
 * a closer, slightly lower composition; their table contents are compacted by
 * the scene so the larger cards still keep every spread position reachable.
 */
export function getTarotViewportComposition(
  width: number,
  height: number,
): TarotViewportComposition {
  const safeWidth = Math.max(1, finiteNumber(width, 1))
  const safeHeight = Math.max(1, finiteNumber(height, 1))
  const aspect = safeWidth / safeHeight
  const fittedDistanceScale =
    aspect < TABLE_FIT_ASPECT
      ? TABLE_FIT_ASPECT / Math.max(TABLE_FIT_MIN_ASPECT, aspect)
      : 1
  const useCompactTableLayout =
    safeWidth <= PHONE_LAYOUT_MAX_WIDTH && aspect < PHONE_LAYOUT_MAX_ASPECT

  return {
    distanceScale: useCompactTableLayout
      ? Math.min(fittedDistanceScale, PHONE_CAMERA_DISTANCE_SCALE)
      : fittedDistanceScale,
    lookAtY: useCompactTableLayout
      ? PHONE_CAMERA_LOOK_AT_Y
      : DEFAULT_CAMERA_LOOK_AT_Y,
    useCompactTableLayout,
  }
}

export function createStackLayout<T>(
  cards: readonly T[],
  options: StackLayoutOptions,
): TarotCardLayout<T>[] {
  const offset = options.offset ?? { x: 0.55, y: -0.4 }
  const maxVisibleLayers = Math.max(
    1,
    Math.floor(finiteNumber(options.maxVisibleLayers, 14)),
  )
  const firstVisibleIndex = Math.max(0, cards.length - maxVisibleLayers)
  const baseRotationDeg = finiteNumber(options.baseRotationDeg, 0)
  const rotationStepDeg = finiteNumber(options.rotationStepDeg, 0.08)
  const startZIndex = Math.floor(finiteNumber(options.startZIndex, 0))

  return cards.map((card, index) => {
    const visibleLayer = Math.max(0, index - firstVisibleIndex)
    return {
      card,
      index,
      x: options.center.x + offset.x * visibleLayer,
      y: options.center.y + offset.y * visibleLayer,
      rotationDeg: baseRotationDeg + rotationStepDeg * visibleLayer,
      zIndex: startZIndex + index,
    }
  })
}

export function createFanLayout<T>(
  cards: readonly T[],
  options: FanLayoutOptions,
): TarotCardLayout<T>[] {
  const radius = Math.max(0, finiteNumber(options.radius, 0))
  const arcDeg = finiteNumber(options.arcDeg, 66)
  const rotationDeg = finiteNumber(options.rotationDeg, 0)
  const startZIndex = Math.floor(finiteNumber(options.startZIndex, 0))
  const denominator = Math.max(1, cards.length - 1)

  return cards.map((card, index) => {
    const progress = cards.length === 1 ? 0.5 : index / denominator
    const cardArcDeg = (progress - 0.5) * arcDeg
    const cardArcRadians = (cardArcDeg * Math.PI) / 180
    const localOffset = {
      x: Math.sin(cardArcRadians) * radius,
      y: (1 - Math.cos(cardArcRadians)) * radius,
    }
    const offset = rotatePoint(localOffset, rotationDeg)

    return {
      card,
      index,
      x: options.center.x + offset.x,
      y: options.center.y + offset.y,
      rotationDeg: rotationDeg + cardArcDeg,
      zIndex: startZIndex + index,
    }
  })
}

/**
 * Clamp the fan's spacing multiplier without changing the size of a card.
 */
export function clampFanSpacingZoom(zoom: number): number {
  const finiteZoom = Number.isFinite(zoom) ? zoom : FAN_SPACING_ZOOM_MIN
  return Math.max(FAN_SPACING_ZOOM_MIN, Math.min(FAN_SPACING_ZOOM_MAX, finiteZoom))
}

/**
 * Transform one fan card's horizontal center. Only the gap from the fan centre
 * is scaled; callers keep the card geometry itself unchanged.
 */
export function transformFanX(
  baseX: number,
  centerX: number,
  zoom: number,
  panX: number,
): number {
  const safeZoom = clampFanSpacingZoom(zoom)
  const safePan = Number.isFinite(panX) ? panX : 0
  return centerX + (baseX - centerX) * safeZoom + safePan
}

/**
 * Return the horizontal pan range needed to inspect both ends of an expanded
 * fan while preventing the deck from being dragged into empty space.
 */
export function getFanPanRange(
  baseXs: readonly number[],
  centerX: number,
  zoom: number,
  viewportWidth: number,
): FanPanRange {
  if (baseXs.length === 0) return { min: 0, max: 0 }
  const safeCenter = Number.isFinite(centerX) ? centerX : 0
  const safeWidth = Math.max(0, Number.isFinite(viewportWidth) ? viewportWidth : 0)
  const transformed = baseXs.map((x) =>
    transformFanX(Number.isFinite(x) ? x : safeCenter, safeCenter, zoom, 0),
  )
  const contentMin = Math.min(...transformed)
  const contentMax = Math.max(...transformed)
  if (contentMax - contentMin <= safeWidth) return { min: 0, max: 0 }

  const viewportLeft = safeCenter - safeWidth / 2
  const viewportRight = safeCenter + safeWidth / 2
  return {
    min: Math.min(0, viewportRight - contentMax),
    max: Math.max(0, viewportLeft - contentMin),
  }
}

export function resetFanViewport(): FanViewportState {
  return { zoom: FAN_SPACING_ZOOM_MIN, panX: 0 }
}

export function getSpreadSlotPoses(
  spread: TarotSpread,
  geometry: SpreadSlotGeometry,
): SpreadSlotPose[] {
  const origin = geometry.origin ?? { x: 0, y: 0 }
  const tableWidth = Math.max(0, finiteNumber(geometry.tableSize.width, 0))
  const tableHeight = Math.max(0, finiteNumber(geometry.tableSize.height, 0))
  const cardWidth = Math.max(0, finiteNumber(geometry.cardSize.width, 0))
  const cardHeight = Math.max(0, finiteNumber(geometry.cardSize.height, 0))

  return spread.slots.map((slot) => ({
    slot,
    x: origin.x + slot.x * tableWidth,
    y: origin.y + slot.y * tableHeight,
    width: cardWidth,
    height: cardHeight,
    rotationDeg: slot.rotationDeg,
    layer: slot.layer ?? slot.order,
  }))
}

export function isPointInsideSpreadSlot(
  point: Point2D,
  pose: SpreadSlotPose,
  padding = 0,
): boolean {
  const safePadding = Math.max(0, finiteNumber(padding, 0))
  const relativePoint = {
    x: point.x - pose.x,
    y: point.y - pose.y,
  }
  const localPoint = rotatePoint(relativePoint, -pose.rotationDeg)
  return (
    Math.abs(localPoint.x) <= pose.width / 2 + safePadding &&
    Math.abs(localPoint.y) <= pose.height / 2 + safePadding
  )
}

export function getSpreadSlotHits(
  point: Point2D,
  spread: TarotSpread,
  geometry: SpreadSlotGeometry,
  options: SpreadSlotHitOptions = {},
): SpreadSlotHit[] {
  const occupiedSlotIds = new Set(options.occupiedSlotIds ?? [])
  const allowedSlotIds = options.allowedSlotIds
    ? new Set(options.allowedSlotIds)
    : null

  return getSpreadSlotPoses(spread, geometry)
    .filter((pose) => !occupiedSlotIds.has(pose.slot.id))
    .filter((pose) => allowedSlotIds === null || allowedSlotIds.has(pose.slot.id))
    .filter((pose) => isPointInsideSpreadSlot(point, pose, options.padding))
    .map((pose) => ({
      slot: pose.slot,
      pose,
      distanceSquared: (point.x - pose.x) ** 2 + (point.y - pose.y) ** 2,
    }))
    .sort((left, right) => {
      if (options.preferredOrder !== undefined) {
        const leftPreferred = left.slot.order === options.preferredOrder
        const rightPreferred = right.slot.order === options.preferredOrder
        if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1
      }
      if (left.distanceSquared !== right.distanceSquared) {
        return left.distanceSquared - right.distanceSquared
      }
      if (left.slot.order !== right.slot.order) {
        return left.slot.order - right.slot.order
      }
      return right.pose.layer - left.pose.layer
    })
}

export function getNextOpenSpreadSlot(
  spread: TarotSpread,
  occupiedSlotIds: readonly string[],
): TarotSpreadSlot | null {
  const occupied = new Set(occupiedSlotIds)
  return (
    [...spread.slots]
      .filter((slot) => !occupied.has(slot.id))
      .sort((left, right) => left.order - right.order)[0] ?? null
  )
}

export function findSpreadSlotAtPoint(
  point: Point2D,
  spread: TarotSpread,
  geometry: SpreadSlotGeometry,
  options: SpreadSlotHitOptions = {},
): SpreadSlotHit | null {
  return getSpreadSlotHits(point, spread, geometry, options)[0] ?? null
}
