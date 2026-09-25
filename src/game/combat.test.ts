import { describe, expect, it } from 'vitest'
import { advanceCombat, createCombat, useAction } from './combat'
import { encounterForRoom } from './content'
import { COMBAT_TICK_MS, derivedStats } from './rules'
import { createNewGame } from './state'
import type { CombatState, Enemy } from './types'

const game = createNewGame()
const stats = derivedStats(game.character, game.equipment)

function bossFight(seed: number, hp = stats.maxHp): CombatState {
  return createCombat(game.character, game.equipment, 5, hp, stats.maxMana, 3, seed)
}

function advance(combat: CombatState, ticks: number): CombatState {
  let next = combat
  for (let index = 0; index < ticks && next.status === 'active'; index++) next = advanceCombat(next, COMBAT_TICK_MS, game.character, game.equipment)
  return next
}

/** Advances whole canonical ticks until the given elapsed time. */
function advanceTo(combat: CombatState, elapsedMs: number): CombatState {
  return advance(combat, elapsedMs / COMBAT_TICK_MS)
}

function telegraphDamage(log: string[]) {
  return Number(log.find(entry => entry.includes('Savage Pounce deals'))?.match(/deals (\d+)/)?.[1])
}

function idleCombat(enemy: Enemy): CombatState {
  return {
    status: 'active', playerHp: stats.maxHp, playerMana: stats.maxMana, potionCharges: 3,
    potionCooldownMs: 0, basicAttackTimerMs: 100_000, globalCooldownMs: 0,
    cooldowns: { heavy: 0, cleave: 0, execute: 0, brace: 0 }, braceActive: false,
    enemies: [enemy], seed: 11, elapsedMs: 0, log: [],
  }
}

describe('data-driven enemy telegraphs', () => {
  it('resolves the telegraph profile and glyph from validated monster content', () => {
    const [boss] = encounterForRoom(5, 1)
    expect(boss.glyph).toBe('♞')
    expect(boss.telegraphProfile).toEqual({ name: 'Savage Pounce', windupMs: 3000, damageMultiplier: 2.2, intervalMs: 12000, firstDelayMs: 9000 })
    expect(boss.nextTelegraphMs).toBe(9000)
  })

  it('gives enemies without a telegraph definition no telegraph and no timer', () => {
    const [slime] = encounterForRoom(0, 1)
    expect(slime.telegraphProfile).toBeUndefined()
    expect(slime.nextTelegraphMs).toBeUndefined()
    expect(advance(idleCombat(slime), 400).enemies[0].telegraph).toBeUndefined()
  })

  it('starts the telegraph from the first-delay, then repeats on the content interval', () => {
    const prepared: number[] = []
    let combat = bossFight(7)
    for (let tick = 1; tick <= 250 && combat.status === 'active'; tick++) {
      const before = combat.enemies[0].telegraph?.name
      combat = advanceCombat(combat, COMBAT_TICK_MS, game.character, game.equipment)
      if (!before && combat.enemies[0].telegraph?.name) prepared.push(combat.elapsedMs)
    }
    // 9,000 ms first delay, then every 12,000 ms of content-defined interval.
    expect(prepared).toEqual([9000, 21000])
  })

  it('resolves the accepted one-step-short windup at the canonical step', () => {
    // GAME_RULES.md records this as implemented behavior: the tick that arms a telegraph also
    // decrements its windup, so the warning is one step shorter than the content's windupMs.
    const armed = advanceTo(bossFight(7), 9_000)
    expect(armed.enemies[0].telegraph?.remainingMs).toBe(2_900)
    expect(advanceTo(armed, 2_800).enemies[0].telegraph?.remainingMs).toBe(100)
    const resolved = advanceTo(armed, 2_900)
    expect(resolved.enemies[0].telegraph).toBeUndefined()
    expect(resolved.log.some(line => line.includes('Savage Pounce deals'))).toBe(true)
  })

  it('applies the content damage multiplier and halves exactly that hit when braced', () => {
    const unbraced = advanceTo(bossFight(7), 11_900)
    const braced = advance(useAction(advanceTo(bossFight(7), 9_000), 'brace', game.character, game.equipment), 29)
    const full = telegraphDamage(unbraced.log)
    const halved = telegraphDamage(braced.log)
    expect(full).toBeGreaterThan(1)
    expect(halved).toBe(Math.round(full / 2))
    expect(braced.log.some(line => line.includes('(BRACED)'))).toBe(true)
    // Brace changes only the telegraphed hit, so every other source of damage is identical.
    expect(stats.maxHp - unbraced.playerHp - full).toBe(stats.maxHp - braced.playerHp - halved)
  })

  it('repeats the identical telegraph sequence for the same seed', () => {
    const run = () => advance(bossFight(19026), 250)
    expect(run()).toEqual(run())
    expect(run().log.length).toBeGreaterThan(0)
  })
})
