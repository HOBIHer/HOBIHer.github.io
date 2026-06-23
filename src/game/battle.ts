import { DEFAULT_METHOD } from './constants'
import { clamp, computeSkillDamagePreview, computeStats, toNumber } from './formulas'
import type { CombatStats, GameItem, LevelConfig } from './types'

export interface BattleSkill extends GameItem {}

export interface Combatant {
  id: string
  name: string
  levelConfig: LevelConfig
  method: GameItem
  skills: BattleSkill[]
  strategy: string[]
  hp: number
  qi: number
}

export interface BattleInput {
  player: Combatant
  enemy: Combatant
  seed: number
  maxSeconds?: number
}

export interface BattleLogLine {
  second: number
  actor: string
  text: string
}

export interface BattleResult {
  winner: 'player' | 'enemy' | 'timeout'
  playerHpAfter: number
  playerQiAfter: number
  enemyHpAfter: number
  enemyQiAfter: number
  elapsedSeconds: number
  logs: BattleLogLine[]
  rewardWorker?: {
    name: string
    level_order: number
    realm_label: string
    efficiency: number
  }
}

interface MutableCombatant extends Combatant {
  stats: CombatStats
  hp: number
  qi: number
  cooldowns: Record<string, number>
  bleeds: Array<{ amount: number; seconds: number }>
}

function makeRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function basicSkill(skills: BattleSkill[]): BattleSkill {
  return (
    skills.find((skill) => skill.is_basic || skill.skill_kind === 'normal_attack') ?? {
      ...DEFAULT_METHOD,
      id: 'normal-attack',
      item_type: 'skill',
      name: '普通攻击',
      description: '最基础的攻击。',
      skill_kind: 'normal_attack',
      proficiency_xp: 600,
      proficiency_required: 600,
      is_basic: true,
    }
  )
}

function toMutable(combatant: Combatant): MutableCombatant {
  const stats = computeStats(combatant.levelConfig, combatant.method)
  return {
    ...combatant,
    hp: clamp(combatant.hp, 1, stats.maxHp),
    qi: clamp(combatant.qi, 0, stats.maxQi),
    stats,
    cooldowns: {},
    bleeds: [],
  }
}

function chooseSkill(actor: MutableCombatant): BattleSkill {
  const skillsById = new Map(actor.skills.filter((skill) => !skill.disabled && !skill.is_locked).map((skill) => [skill.id, skill]))
  for (const id of actor.strategy) {
    const skill = skillsById.get(id)
    if (!skill) continue
    const cost = actor.stats.maxQi * toNumber(skill.qi_cost_pct)
    if ((actor.cooldowns[skill.id] ?? 0) <= 0 && actor.qi >= cost) return skill
  }
  return basicSkill(actor.skills)
}

function tickCooldowns(actor: MutableCombatant) {
  for (const key of Object.keys(actor.cooldowns)) {
    actor.cooldowns[key] = Math.max(0, actor.cooldowns[key] - 1)
  }
}

function applyBleeds(target: MutableCombatant, second: number, logs: BattleLogLine[]) {
  const nextBleeds = []
  for (const bleed of target.bleeds) {
    target.hp = Math.max(0, target.hp - bleed.amount)
    logs.push({
      second,
      actor: target.name,
      text: `${target.name}受到流血 ${Math.floor(bleed.amount)} 点`,
    })
    if (bleed.seconds > 1) nextBleeds.push({ amount: bleed.amount, seconds: bleed.seconds - 1 })
  }
  target.bleeds = nextBleeds
}

function useSkill(
  actor: MutableCombatant,
  target: MutableCombatant,
  skill: BattleSkill,
  rng: () => number,
  second: number,
  logs: BattleLogLine[],
) {
  const cost = Math.floor(actor.stats.maxQi * toNumber(skill.qi_cost_pct))
  actor.qi = Math.max(0, actor.qi - cost)
  actor.cooldowns[skill.id] = toNumber(skill.cooldown_sec)

  const preview = computeSkillDamagePreview(actor.stats, target.stats, skill, actor.method)
  let damage = preview.damage
  let suffix = ''

  if (skill.skill_kind === 'crit_strike') {
    const chance = toNumber(skill.effect_json?.crit_chance, 0.2)
    const multiplier = toNumber(skill.effect_json?.crit_multiplier, 1.5)
    if (rng() < chance) {
      damage = Math.floor(damage * multiplier)
      suffix = '，暴击'
    }
  }

  if (skill.skill_kind === 'bleed') {
    const bleedPct = toNumber(skill.effect_json?.bleed_pct, 0.15)
    const bleedSeconds = Math.max(1, Math.floor(toNumber(skill.effect_json?.bleed_seconds, 3)))
    target.bleeds.push({
      amount: Math.max(1, Math.floor(damage * bleedPct)),
      seconds: bleedSeconds,
    })
    suffix = `，流血${bleedSeconds}秒`
  }

  if (skill.skill_kind === 'dodge_buff' || skill.skill_kind === 'shield' || skill.skill_kind === 'qi_burn') {
    suffix = '，效果已记录'
  }

  target.hp = Math.max(0, target.hp - damage)
  logs.push({
    second,
    actor: actor.name,
    text: `${actor.name}施展${skill.name}，造成 ${damage} 点伤害${suffix}`,
  })
}

export function simulateBattle(input: BattleInput): BattleResult {
  const rng = makeRng(input.seed)
  const player = toMutable(input.player)
  const enemy = toMutable(input.enemy)
  const maxSeconds = input.maxSeconds ?? 180
  const logs: BattleLogLine[] = []

  for (let second = 1; second <= maxSeconds; second += 1) {
    tickCooldowns(player)
    tickCooldowns(enemy)
    applyBleeds(player, second, logs)
    applyBleeds(enemy, second, logs)

    if (player.hp <= 0 || enemy.hp <= 0) {
      const winner = enemy.hp <= 0 && player.hp > 0 ? 'player' : 'enemy'
      return finishResult(winner, player, enemy, second, logs, rng)
    }

    const playerSkill = chooseSkill(player)
    const enemySkill = chooseSkill(enemy)
    useSkill(player, enemy, playerSkill, rng, second, logs)
    if (enemy.hp > 0) {
      useSkill(enemy, player, enemySkill, rng, second, logs)
    }

    if (player.hp <= 0 || enemy.hp <= 0) {
      const winner = enemy.hp <= 0 && player.hp > 0 ? 'player' : 'enemy'
      return finishResult(winner, player, enemy, second, logs, rng)
    }
  }

  const playerHpPct = player.hp / player.stats.maxHp
  const enemyHpPct = enemy.hp / enemy.stats.maxHp
  return finishResult(playerHpPct > enemyHpPct ? 'player' : 'timeout', player, enemy, maxSeconds, logs, rng)
}

function finishResult(
  winner: 'player' | 'enemy' | 'timeout',
  player: MutableCombatant,
  enemy: MutableCombatant,
  elapsedSeconds: number,
  logs: BattleLogLine[],
  rng: () => number,
): BattleResult {
  if (winner === 'player') {
    logs.push({
      second: elapsedSeconds,
      actor: player.name,
      text: `${player.name}击败了${enemy.name}`,
    })
  } else {
    logs.push({
      second: elapsedSeconds,
      actor: enemy.name,
      text: winner === 'timeout' ? '战斗超时，对手占据上风' : `${enemy.name}放你一马`,
    })
  }

  return {
    winner,
    playerHpAfter: Math.max(winner === 'player' ? 1 : 1, Math.floor(player.hp)),
    playerQiAfter: Math.max(0, Math.floor(player.qi)),
    enemyHpAfter: Math.max(0, Math.floor(enemy.hp)),
    enemyQiAfter: Math.max(0, Math.floor(enemy.qi)),
    elapsedSeconds,
    logs,
    rewardWorker:
      winner === 'player'
        ? {
            name: `${enemy.name}`,
            level_order: enemy.levelConfig.level_order,
            realm_label: enemy.levelConfig.label,
            efficiency: Math.round((0.8 + rng() * 0.4) * 100) / 100,
          }
        : undefined,
  }
}
