import { describe, expect, it } from 'vitest'
import { GuessRecord, GuessUser, computeRecord, computeUserStats, getRankInfo } from '../game/guessSaint'

const baseRecord: GuessRecord = {
  id: 'record-1',
  date: '2026-07-01',
  stake: 100,
  odds: 2.5,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  legs: [
    {
      id: 'leg-1',
      homeTeam: '甲队',
      awayTeam: '乙队',
      handicap: -1,
      pick: 'win',
      homeScore: 3,
      awayScore: 1,
    },
  ],
}

describe('world cup guess saint formulas', () => {
  it('computes income, net profit, and positive score for a correct single bet', () => {
    const record = computeRecord(baseRecord, 0)

    expect(record.hitAll).toBe(true)
    expect(record.income).toBe(250)
    expect(record.netProfit).toBe(150)
    expect(record.scoreImpact).toBeGreaterThan(0)
    expect(record.predictionText).toContain('让球-1胜')
    expect(record.actualText).toContain('对')
  })

  it('penalizes failed parlays and keeps the score impact negative', () => {
    const record = computeRecord(
      {
        ...baseRecord,
        id: 'record-2',
        legs: [
          baseRecord.legs[0],
          {
            id: 'leg-2',
            homeTeam: '丙队',
            awayTeam: '丁队',
            handicap: 0,
            pick: 'draw',
            homeScore: 0,
            awayScore: 2,
          },
        ],
      },
      12,
    )

    expect(record.hitAll).toBe(false)
    expect(record.income).toBe(0)
    expect(record.netProfit).toBe(-100)
    expect(record.scoreImpact).toBeLessThan(0)
    expect(record.actualText).toContain('错')
  })

  it('maps positive and negative scores onto separate rank paths', () => {
    expect(getRankInfo(0).label).toBe('零分初心')
    expect(getRankInfo(235).label).toBe('赌师四段')
    expect(getRankInfo(-642).label).toBe('赌魔五段')
  })

  it('aggregates user stats from chronological records', () => {
    const user: GuessUser = {
      id: 'user-1',
      name: '测试土块',
      records: [baseRecord],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    }
    const stats = computeUserStats(user)

    expect(stats.totalProfit).toBe(150)
    expect(stats.score).toBe(stats.computedRecords[0].scoreImpact)
    expect(stats.rank.path).toBe('positive')
  })
})
