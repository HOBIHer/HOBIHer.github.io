export type PickResult = 'win' | 'draw' | 'lose'
export type RankPath = 'positive' | 'negative' | 'neutral'

export interface GuessLeg {
  id: string
  homeTeam: string
  awayTeam: string
  handicap: number
  pick: PickResult
  homeScore: number
  awayScore: number
}

export interface GuessRecord {
  id: string
  date: string
  legs: GuessLeg[]
  stake: number
  odds: number
  batchGroupId?: string
  batchParticipantCount?: number
  createdAt: string
  updatedAt: string
}

export interface GuessUser {
  id: string
  name: string
  avatarDataUrl?: string
  records: GuessRecord[]
  createdAt: string
  updatedAt: string
}

export interface ComputedLeg extends GuessLeg {
  adjustedDiff: number
  actualPick: PickResult
  correct: boolean
  marginLabel: string
}

export interface ComputedRecord extends GuessRecord {
  legs: ComputedLeg[]
  predictionText: string
  actualText: string
  hitAll: boolean
  correctLegs: number
  income: number
  netProfit: number
  scoreImpact: number
  formulaText: string
}

export interface RankInfo {
  path: RankPath
  name: string
  level: number
  label: string
  score: number
  progressPercent: number
  nextLabel: string
  scoreToNext: number
}

export interface UserStats {
  score: number
  totalProfit: number
  rank: RankInfo
  computedRecords: ComputedRecord[]
}

export const POSITIVE_RANKS = [
  '赌之气',
  '赌者',
  '赌师',
  '大赌师',
  '赌灵',
  '赌王',
  '赌皇',
  '赌宗',
  '赌尊',
  '赌圣',
  '赌帝',
]

export const NEGATIVE_RANKS = [
  '慈善协会副科长',
  '慈善协会科长',
  '慈善协会副处长',
  '慈善协会处长',
  '慈善协会副局长',
  '慈善协会局长',
  '慈善协会副厅长',
  '慈善协会厅长',
  '慈善协会副部长',
  '慈善协会部长',
  '慈善协会会长',
]

export const RANK_BAND_SIZE = 100
export const RANK_AXIS_LIMIT = POSITIVE_RANKS.length * RANK_BAND_SIZE
const BASE_STAKE_FOR_SCORE = 100

const LEVEL_LABELS = ['一段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段', '十段']

export function formatMoney(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

export function formatHandicap(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `${value}`
  return '0'
}

export function pickLabel(pick: PickResult): string {
  if (pick === 'win') return '胜'
  if (pick === 'draw') return '平'
  return '负'
}

export function actualPickFromDiff(diff: number): PickResult {
  if (diff > 0) return 'win'
  if (diff < 0) return 'lose'
  return 'draw'
}

export function getAdjustedDiff(leg: GuessLeg): number {
  return Number(leg.homeScore || 0) + Number(leg.handicap || 0) - Number(leg.awayScore || 0)
}

export function marginLabel(diff: number): string {
  if (diff >= 3) return '大胜'
  if (diff > 0) return '小胜'
  if (diff === 0) return '让平'
  if (diff <= -3) return '大负'
  return '小负'
}

function marginMultiplier(diffs: number[]): number {
  if (!diffs.length) return 1
  const total = diffs.reduce((sum, diff) => {
    const abs = Math.abs(diff)
    if (abs >= 3) return sum + 1.35
    if (abs === 2) return sum + 1.15
    if (abs === 1) return sum + 1
    return sum + 0.85
  }, 0)
  return total / diffs.length
}

export function computeLeg(leg: GuessLeg): ComputedLeg {
  const adjustedDiff = getAdjustedDiff(leg)
  const actualPick = actualPickFromDiff(adjustedDiff)
  return {
    ...leg,
    adjustedDiff,
    actualPick,
    correct: leg.pick === actualPick,
    marginLabel: marginLabel(adjustedDiff),
  }
}

export function formatPrediction(legs: GuessLeg[]): string {
  return legs
    .map(
      (leg, index) =>
        `关卡${index + 1}:${leg.homeTeam || '主队'} vs ${leg.awayTeam || '客队'} 让球${formatHandicap(
          leg.handicap,
        )}${pickLabel(leg.pick)}`,
    )
    .join(' -> ')
}

export function formatActual(legs: ComputedLeg[]): string {
  return legs
    .map(
      (leg, index) =>
        `关卡${index + 1}:${leg.correct ? '对' : '错'}，{${leg.homeScore}-${leg.awayScore}，${leg.marginLabel}}`,
    )
    .join(' -> ')
}

export function computeRecord(record: GuessRecord, previousRecordCount: number): ComputedRecord {
  const computedLegs = record.legs.map(computeLeg)
  const legCount = Math.max(computedLegs.length, 1)
  const correctLegs = computedLegs.filter((leg) => leg.correct).length
  const hitAll = correctLegs === computedLegs.length && computedLegs.length > 0
  const stake = Math.max(0, Number(record.stake || 0))
  const odds = Math.max(0, Number(record.odds || 0))
  const income = hitAll ? stake * odds : 0
  const netProfit = income - stake
  const parlayMultiplier = Math.min(2.2, 1 + (legCount - 1) * 0.22)
  const experienceMultiplier = 1 + Math.min(0.75, Math.log10(previousRecordCount + 1) * 0.32)
  const stakeMultiplier = Math.max(0.1, stake / BASE_STAKE_FOR_SCORE)
  const profitRate = Math.abs(netProfit) / Math.max(stake, 1)
  const moneyMultiplier = 1 + Math.min(0.65, Math.log10(profitRate + 1) * 0.55)
  const strengthMultiplier = marginMultiplier(computedLegs.map((leg) => leg.adjustedDiff))
  const hitRate = correctLegs / legCount
  let scoreImpact: number

  if (hitAll) {
    const base = 14 + legCount * 3
    scoreImpact = Math.round(base * parlayMultiplier * experienceMultiplier * stakeMultiplier * moneyMultiplier * strengthMultiplier)
  } else {
    const base = 10 + legCount * 2
    const missPressure = 0.72 + (1 - hitRate) * 0.48
    scoreImpact = -Math.round(base * parlayMultiplier * experienceMultiplier * stakeMultiplier * moneyMultiplier * strengthMultiplier * missPressure)
  }

  if (scoreImpact === 0) scoreImpact = hitAll ? 1 : -1

  return {
    ...record,
    legs: computedLegs,
    predictionText: formatPrediction(record.legs),
    actualText: formatActual(computedLegs),
    hitAll,
    correctLegs,
    income,
    netProfit,
    scoreImpact,
    formulaText: `关数x${parlayMultiplier.toFixed(2)} / 历练x${experienceMultiplier.toFixed(2)} / 下注x${stakeMultiplier.toFixed(
      2,
    )} / 盈亏x${moneyMultiplier.toFixed(2)} / 赛果x${strengthMultiplier.toFixed(2)}`,
  }
}

function sortedRecords(records: GuessRecord[]): GuessRecord[] {
  return [...records].sort((a, b) => {
    const dateOrder = a.date.localeCompare(b.date)
    if (dateOrder !== 0) return dateOrder
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function computeUserStats(user: GuessUser): UserStats {
  const computedRecords = sortedRecords(user.records).map((record, index) => computeRecord(record, index))
  const score = computedRecords.reduce((sum, record) => sum + record.scoreImpact, 0)
  const totalProfit = computedRecords.reduce((sum, record) => sum + record.netProfit, 0)

  return {
    score,
    totalProfit,
    rank: getRankInfo(score),
    computedRecords,
  }
}

function rankFromMagnitude(score: number, names: string[], path: RankPath): RankInfo {
  const magnitude = Math.abs(score)
  const cappedBand = Math.min(names.length - 1, Math.floor(magnitude / RANK_BAND_SIZE))
  const bandStart = cappedBand * RANK_BAND_SIZE
  const inBand = Math.max(0, Math.min(RANK_BAND_SIZE - 1, magnitude - bandStart))
  const level = Math.min(10, Math.floor(inBand / 10) + 1)
  const nextThreshold = Math.min(RANK_AXIS_LIMIT, bandStart + level * 10)
  const scoreToNext = Math.max(0, nextThreshold - magnitude)
  const progressPercent = 50 + (path === 'positive' ? 1 : -1) * Math.min(50, (magnitude / RANK_AXIS_LIMIT) * 50)

  return {
    path,
    name: names[cappedBand],
    level,
    label: `${names[cappedBand]}${LEVEL_LABELS[level - 1]}`,
    score,
    progressPercent,
    nextLabel: scoreToNext === 0 ? '已抵达下一段' : `距下一段 ${scoreToNext} 分`,
    scoreToNext,
  }
}

export function getRankInfo(score: number): RankInfo {
  if (score > 0) return rankFromMagnitude(score, POSITIVE_RANKS, 'positive')
  if (score < 0) return rankFromMagnitude(score, NEGATIVE_RANKS, 'negative')

  return {
    path: 'neutral',
    name: '零分初心',
    level: 0,
    label: '零分初心',
    score,
    progressPercent: 50,
    nextLabel: '向右入圣，向左成怪',
    scoreToNext: 1,
  }
}
