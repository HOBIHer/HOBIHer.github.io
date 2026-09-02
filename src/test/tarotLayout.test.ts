import { describe, expect, it } from 'vitest'
import { TAROT_CARD_COUNT, TAROT_CARDS } from '../tarot/catalog'
import {
  FAN_SPACING_ZOOM_MAX,
  FAN_SPACING_ZOOM_MIN,
  clampFanSpacingZoom,
  createFanLayout,
  createStackLayout,
  findSpreadSlotAtPoint,
  getFanPanRange,
  getSpreadSlotHits,
  resetFanViewport,
  transformFanX,
  type SpreadSlotGeometry,
} from '../tarot/layout'
import { getTarotSpread, TAROT_SPREADS } from '../tarot/spreads'
import type { TarotSuit } from '../tarot/types'

describe('tarot catalog', () => {
  it('contains exactly 78 uniquely identified cards in contiguous deck order', () => {
    expect(TAROT_CARD_COUNT).toBe(78)
    expect(TAROT_CARDS).toHaveLength(78)
    expect(TAROT_CARDS.map((card) => card.deckIndex)).toEqual(
      Array.from({ length: 78 }, (_, index) => index),
    )
    expect(new Set(TAROT_CARDS.map((card) => card.deckIndex)).size).toBe(78)
    expect(new Set(TAROT_CARDS.map((card) => card.id)).size).toBe(78)
  })

  it.each<TarotSuit>(['wands', 'cups', 'swords', 'pentacles'])(
    'contains 14 %s cards',
    (suit) => {
      expect(TAROT_CARDS.filter((card) => card.suit === suit)).toHaveLength(14)
    },
  )
})

describe('tarot deck layouts', () => {
  const cards = ['a', 'b', 'c', 'd', 'e'] as const

  it('creates a deterministic stack within the configured visible-layer bounds', () => {
    const options = {
      center: { x: 100, y: 200 },
      offset: { x: 2, y: -1 },
      baseRotationDeg: -1,
      rotationStepDeg: 0.25,
      maxVisibleLayers: 3,
      startZIndex: 7,
    }

    const layout = createStackLayout(cards, options)

    expect(layout).toEqual(createStackLayout(cards, options))
    expect(
      layout.map(({ index, x, y, rotationDeg, zIndex }) => ({
        index,
        x,
        y,
        rotationDeg,
        zIndex,
      })),
    ).toEqual([
      { index: 0, x: 100, y: 200, rotationDeg: -1, zIndex: 7 },
      { index: 1, x: 100, y: 200, rotationDeg: -1, zIndex: 8 },
      { index: 2, x: 100, y: 200, rotationDeg: -1, zIndex: 9 },
      { index: 3, x: 102, y: 199, rotationDeg: -0.75, zIndex: 10 },
      { index: 4, x: 104, y: 198, rotationDeg: -0.5, zIndex: 11 },
    ])
    expect(createStackLayout([], options)).toEqual([])
  })

  it('creates a deterministic fan whose endpoints and cards stay inside the arc bounds', () => {
    const fanCards = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const
    const options = {
      center: { x: 100, y: 200 },
      radius: 100,
      arcDeg: 60,
      startZIndex: 10,
    }

    const layout = createFanLayout(fanCards, options)

    expect(layout).toEqual(createFanLayout(fanCards, options))
    expect(layout[0].x).toBeCloseTo(50)
    expect(layout[0].rotationDeg).toBeCloseTo(-30)
    expect(layout[layout.length - 1].x).toBeCloseTo(150)
    expect(layout[layout.length - 1].rotationDeg).toBeCloseTo(30)
    expect(layout[3]).toMatchObject({ x: 100, y: 200, rotationDeg: 0 })

    for (const [index, pose] of layout.entries()) {
      expect(pose.x).toBeGreaterThanOrEqual(50)
      expect(pose.x).toBeLessThanOrEqual(150)
      expect(pose.y).toBeGreaterThanOrEqual(200)
      expect(pose.y).toBeLessThanOrEqual(200 + 100 * (1 - Math.cos(Math.PI / 6)))
      expect(pose.rotationDeg).toBeGreaterThanOrEqual(-30)
      expect(pose.rotationDeg).toBeLessThanOrEqual(30)
      expect(pose.zIndex).toBe(10 + index)
    }

    expect(createFanLayout(['only'], options)[0]).toMatchObject({
      x: 100,
      y: 200,
      rotationDeg: 0,
    })
    expect(createFanLayout([], options)).toEqual([])
  })
})

describe('tarot fan viewport', () => {
  const centerX = 150
  const basePoses = [
    { x: 100, width: 72, height: 118 },
    { x: 150, width: 72, height: 118 },
    { x: 200, width: 72, height: 118 },
  ] as const

  it('clamps spacing zoom to the supported 1x through 2.6x range', () => {
    expect(clampFanSpacingZoom(0.2)).toBe(FAN_SPACING_ZOOM_MIN)
    expect(clampFanSpacingZoom(1)).toBe(1)
    expect(clampFanSpacingZoom(1.8)).toBe(1.8)
    expect(clampFanSpacingZoom(2.6)).toBe(2.6)
    expect(clampFanSpacingZoom(9)).toBe(FAN_SPACING_ZOOM_MAX)
    expect(clampFanSpacingZoom(Number.NaN)).toBe(FAN_SPACING_ZOOM_MIN)
  })

  it('expands only card spacing at 2.6x while preserving card dimensions', () => {
    const atOneX = basePoses.map((pose) => ({
      ...pose,
      x: transformFanX(pose.x, centerX, 1, 0),
    }))
    const atMaxZoom = basePoses.map((pose) => ({
      ...pose,
      x: transformFanX(pose.x, centerX, 2.6, 0),
    }))

    expect(atOneX.map((pose) => pose.x)).toEqual([100, 150, 200])
    expect(atMaxZoom.map((pose) => pose.x)).toEqual([20, 150, 280])
    expect(atMaxZoom[1].x - atMaxZoom[0].x).toBe(
      (atOneX[1].x - atOneX[0].x) * 2.6,
    )
    expect(atMaxZoom.map(({ width, height }) => ({ width, height }))).toEqual(
      atOneX.map(({ width, height }) => ({ width, height })),
    )
  })

  it('returns bounded horizontal pan limits that expose either expanded fan end', () => {
    const baseXs = basePoses.map((pose) => pose.x)

    expect(getFanPanRange(baseXs, centerX, 1, 200)).toEqual({ min: 0, max: 0 })

    const range = getFanPanRange(baseXs, centerX, 2.6, 100)
    expect(range).toEqual({ min: -80, max: 80 })
    expect(transformFanX(baseXs[baseXs.length - 1], centerX, 2.6, range.min)).toBe(200)
    expect(transformFanX(baseXs[0], centerX, 2.6, range.max)).toBe(100)
    expect(getFanPanRange([], centerX, 2.6, 100)).toEqual({ min: 0, max: 0 })
  })

  it('provides the canonical spacing and pan reset for a collapse transition', () => {
    expect(resetFanViewport()).toEqual({
      zoom: FAN_SPACING_ZOOM_MIN,
      panX: 0,
    })
  })
})

describe('tarot spreads and hit testing', () => {
  const geometry: SpreadSlotGeometry = {
    tableSize: { width: 1_000, height: 1_000 },
    cardSize: { width: 100, height: 160 },
  }

  it('defines the three supported spreads with matching slot counts', () => {
    expect(
      TAROT_SPREADS.map((spread) => ({
        id: spread.id,
        cardCount: spread.cardCount,
        slotCount: spread.slots.length,
      })),
    ).toEqual([
      { id: 'single', cardCount: 1, slotCount: 1 },
      { id: 'three-card-timeline', cardCount: 3, slotCount: 3 },
      { id: 'celtic-cross', cardCount: 10, slotCount: 10 },
    ])
  })

  it('selects the overlapping Celtic Cross slots in occupation order', () => {
    const spread = getTarotSpread('celtic-cross')
    expect(spread).toBeDefined()
    if (!spread) throw new Error('Celtic Cross spread is missing')

    const sharedCenter = { x: 340, y: 500 }

    expect(getSpreadSlotHits(sharedCenter, spread, geometry).map((hit) => hit.slot.id)).toEqual([
      'present',
      'challenge',
    ])
    expect(findSpreadSlotAtPoint(sharedCenter, spread, geometry)?.slot.id).toBe('present')
    expect(
      findSpreadSlotAtPoint(sharedCenter, spread, geometry, {
        occupiedSlotIds: ['present'],
      })?.slot.id,
    ).toBe('challenge')
    expect(
      findSpreadSlotAtPoint(sharedCenter, spread, geometry, {
        occupiedSlotIds: ['present', 'challenge'],
      }),
    ).toBeNull()
  })

  it('does not hit a point outside every spread slot', () => {
    const spread = getTarotSpread('celtic-cross')
    expect(spread).toBeDefined()
    if (!spread) throw new Error('Celtic Cross spread is missing')

    expect(findSpreadSlotAtPoint({ x: -1_000, y: -1_000 }, spread, geometry)).toBeNull()
  })
})
