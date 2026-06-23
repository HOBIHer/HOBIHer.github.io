import { describe, expect, it } from 'vitest'
import { DEFAULT_METHOD } from '../game/constants'
import { computeLevelSeedConfig } from '../game/formulas'
import { simulateBattle } from '../game/battle'
import type { GameItem } from '../game/types'

const basic: GameItem = {
  ...DEFAULT_METHOD,
  id: 'basic',
  item_type: 'skill',
  name: '普通攻击',
  skill_kind: 'normal_attack',
  proficiency_xp: 600,
  proficiency_required: 600,
  is_basic: true,
}

describe('battle simulator', () => {
  it('is deterministic for the same seed', () => {
    const level = computeLevelSeedConfig(0, 1)
    const input = {
      seed: 42,
      player: {
        id: 'p',
        name: '玩家',
        levelConfig: level,
        method: DEFAULT_METHOD,
        skills: [basic],
        strategy: [],
        hp: 100,
        qi: 60,
      },
      enemy: {
        id: 'e',
        name: '山门弟子',
        levelConfig: level,
        method: DEFAULT_METHOD,
        skills: [basic],
        strategy: [],
        hp: 80,
        qi: 60,
      },
      maxSeconds: 30,
    }

    expect(simulateBattle(input)).toEqual(simulateBattle(input))
  })
})
