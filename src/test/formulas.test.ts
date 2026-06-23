import { describe, expect, it } from 'vitest'
import { computeLevelSeedConfig, computeStats, getLevelLabel } from '../game/formulas'
import { DEFAULT_METHOD } from '../game/constants'

describe('cultivation formulas', () => {
  it('generates 108 ordered labels', () => {
    expect(getLevelLabel(0)).toBe('斗之气一段')
    expect(getLevelLabel(8)).toBe('斗之气九段')
    expect(getLevelLabel(9)).toBe('一星斗者')
    expect(getLevelLabel(107)).toBe('九星斗帝')
  })

  it('computes stable seed stats', () => {
    const level = computeLevelSeedConfig(0, 1)
    expect(level.threshold).toBe(300)
    expect(level.base_rate_per_sec).toBe(1)
    expect(computeStats(level, DEFAULT_METHOD)).toEqual({
      maxHp: 100,
      maxQi: 60,
      attack: 8,
      defense: 2,
    })
  })
})
