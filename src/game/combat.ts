import { encounterForRoom } from './content'
import { combatSkills } from './content-loader'
import { derivedStats, hitChance, mitigation } from './rules'
import { nextRandom } from './rng'
import type { CombatState, Equipment, Character, Enemy } from './types'

export type SkillId = 'heavy' | 'cleave' | 'execute' | 'brace' | 'potion'

function addLog(combat: CombatState, line: string) {
  combat.log = [line, ...combat.log].slice(0, 8)
}

function rollPlayerAttack(combat: CombatState, character: Character, equipment: Equipment, coefficient: number, target: Enemy) {
  const stats = derivedStats(character, equipment)
  let hitRoll: number
  ;[hitRoll, combat.seed] = nextRandom(combat.seed)
  if (hitRoll >= hitChance(stats.accuracyBonus, target.dodge ?? 0)) return { hit: false, damage: 0, critical: false }
  let roll: number
  ;[roll, combat.seed] = nextRandom(combat.seed)
  const randomFactor = 0.9 + roll * 0.2
  let critRoll: number
  ;[critRoll, combat.seed] = nextRandom(combat.seed)
  const critical = critRoll < stats.critChance
  const blessing = 1
  const damage = Math.max(1, Math.round(stats.attackDamage * randomFactor * coefficient * (critical ? 1.5 : 1) * (1 - mitigation(target.armor, character.level)) * blessing))
  return { hit: true, damage, critical }
}

function damageEnemy(combat: CombatState, character: Character, equipment: Equipment, enemy: Enemy, coefficient: number, label: string) {
  const { hit, damage, critical } = rollPlayerAttack(combat, character, equipment, coefficient, enemy)
  if (!hit) {
    addLog(combat, `Your attack misses ${enemy.name}.`)
    return
  }
  enemy.hp = Math.max(0, enemy.hp - damage)
  addLog(combat, `${label} hits ${enemy.name} for ${damage}${critical ? ' CRIT!' : '.'}`)
}

export function createCombat(character: Character, equipment: Equipment, roomIndex: number, hp: number, mana: number, potions: number, seed: number): CombatState {
  return {
    status: 'active', playerHp: hp, playerMana: mana, potionCharges: potions,
    potionCooldownMs: 0, basicAttackTimerMs: 400, globalCooldownMs: 0,
    cooldowns: { heavy: 0, cleave: 0, execute: 0, brace: 0 },
    braceActive: false, enemies: encounterForRoom(roomIndex, character.level), seed,
    elapsedMs: 0, log: ['Enemies emerge from the Greenwood.'],
  }
}

function checkOutcome(combat: CombatState) {
  if (combat.playerHp <= 0) combat.status = 'lost'
  else if (combat.enemies.every((enemy) => enemy.hp <= 0)) combat.status = 'won'
}

export function advanceCombat(source: CombatState, deltaMs: number, character: Character, equipment: Equipment): CombatState {
  if (source.status !== 'active') return source
  const combat = structuredClone(source)
  const stats = derivedStats(character, equipment)
  combat.elapsedMs += deltaMs
  combat.playerMana = Math.min(stats.maxMana, combat.playerMana + stats.manaRegenPerSecond * deltaMs / 1000)
  combat.basicAttackTimerMs -= deltaMs
  combat.globalCooldownMs = Math.max(0, combat.globalCooldownMs - deltaMs)
  combat.potionCooldownMs = Math.max(0, combat.potionCooldownMs - deltaMs)
  for (const key of Object.keys(combat.cooldowns) as Array<keyof typeof combat.cooldowns>) combat.cooldowns[key] = Math.max(0, combat.cooldowns[key] - deltaMs)

  const target = combat.enemies.find((enemy) => enemy.hp > 0)
  if (target && combat.basicAttackTimerMs <= 0) {
    damageEnemy(combat, character, equipment, target, 1, 'Basic attack')
    combat.basicAttackTimerMs += stats.attackIntervalMs
  }

  for (const enemy of combat.enemies) {
    if (enemy.hp <= 0 || combat.playerHp <= 0) continue
    enemy.attackTimerMs -= deltaMs
    if (enemy.nextTelegraphMs !== undefined && enemy.telegraphProfile) {
      enemy.nextTelegraphMs -= deltaMs
      if (enemy.nextTelegraphMs <= 0 && !enemy.telegraph) {
        const { name, windupMs, damageMultiplier, intervalMs } = enemy.telegraphProfile
        enemy.telegraph = { name, remainingMs: windupMs, damageMultiplier }
        enemy.nextTelegraphMs = intervalMs
        addLog(combat, `${enemy.name} prepares ${name}!`)
      }
    }
    if (enemy.telegraph) {
      enemy.telegraph.remainingMs -= deltaMs
      if (enemy.telegraph.remainingMs <= 0) {
        const reduced = combat.braceActive ? 0.5 : 1
        const hit = Math.max(1, Math.round(enemy.damage * enemy.telegraph.damageMultiplier * reduced * (1 - mitigation(stats.armor, enemy.level))))
        combat.playerHp = Math.max(0, combat.playerHp - hit)
        addLog(combat, `${enemy.telegraph.name} deals ${hit}${combat.braceActive ? ' (BRACED).' : '!'}`)
        combat.braceActive = false
        enemy.telegraph = undefined
      }
    } else if (enemy.attackTimerMs <= 0) {
      enemy.attackTimerMs += enemy.attackIntervalMs
      let attackRoll: number
      ;[attackRoll, combat.seed] = nextRandom(combat.seed)
      if (attackRoll >= hitChance(0, stats.dodge)) {
        addLog(combat, `${enemy.name} misses you.`)
      } else {
        const hit = Math.max(1, Math.round(enemy.damage * (1 - mitigation(stats.armor, enemy.level))))
        combat.playerHp = Math.max(0, combat.playerHp - hit)
        addLog(combat, `${enemy.name} strikes for ${hit}.`)
      }
    }
  }
  checkOutcome(combat)
  return combat
}

export function useAction(source: CombatState, action: SkillId, character: Character, equipment: Equipment): CombatState {
  if (source.status !== 'active') return source
  const combat = structuredClone(source)
  const stats = derivedStats(character, equipment)
  if (action === 'potion') {
    if (!combat.potionCharges || combat.potionCooldownMs > 0 || combat.playerHp >= stats.maxHp) return source
    combat.potionCharges--
    combat.potionCooldownMs = 12000
    combat.playerHp = Math.min(stats.maxHp, combat.playerHp + Math.round(stats.maxHp * 0.3))
    addLog(combat, 'Potion restores 30% maximum HP.')
    return combat
  }
  if (combat.globalCooldownMs > 0 || combat.cooldowns[action] > 0) return source
  if (action === 'brace') {
    combat.braceActive = true
    combat.cooldowns.brace = 8000
    combat.globalCooldownMs = 500
    addLog(combat, 'You brace against the next telegraphed attack.')
    return combat
  }
  const skill = combatSkills[action]
  if (combat.playerMana < skill.manaCost) return source
  combat.playerMana -= skill.manaCost
  combat.globalCooldownMs = 500
  const living = combat.enemies.filter((enemy) => enemy.hp > 0)
  if (action === 'heavy') {
    damageEnemy(combat, character, equipment, living[0], skill.coefficient, skill.name)
    combat.cooldowns.heavy = skill.cooldownMs
  } else if (action === 'cleave') {
    living.forEach((enemy) => damageEnemy(combat, character, equipment, enemy, skill.coefficient, skill.name))
    combat.cooldowns.cleave = skill.cooldownMs
  } else {
    const target = living[0]
    damageEnemy(combat, character, equipment, target, target.hp / target.maxHp < 0.25 ? skill.lowHealthCoefficient ?? skill.coefficient : skill.coefficient, skill.name)
    combat.cooldowns.execute = skill.cooldownMs
  }
  checkOutcome(combat)
  return combat
}
