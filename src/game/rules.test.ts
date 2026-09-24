import { describe, expect, it } from 'vitest'
import { starterArmor, starterWeapon } from './content'
import { advanceCombat, createCombat, useAction } from './combat'
import { modifiedRarityWeights, rollItem } from './loot'
import {
  arcaneMitigation, baseWeaponDamage, derivedStats, enemyBaseHp, hitChance,
  mitigation, MIN_ATTACK_INTERVAL_MS, xpRequired,
} from './rules'
import { addXp, createNewGame, loadGame, SAVE_KEY } from './state'
import type { Attributes, GameState } from './types'

function gameWithAttributes(changes: Partial<Attributes>) {
  const game = createNewGame()
  game.character.attributes = { ...game.character.attributes, ...changes }
  return game
}

describe('authoritative formulas', () => {
  it('matches core level-one formula values', () => {
    expect(xpRequired(1)).toBe(100)
    expect(Math.round(baseWeaponDamage(1))).toBe(13)
    expect(Math.round(enemyBaseHp(1))).toBe(52)
  })

  it('adds 0.5% Greatsword scaling for one STR', () => {
    const before = gameWithAttributes({ str: 10 })
    const after = gameWithAttributes({ str: 11 })
    const beforeStats = derivedStats(before.character, before.equipment)
    const afterStats = derivedStats(after.character, after.equipment)
    expect(afterStats.greatswordDamageBonus - beforeStats.greatswordDamageBonus).toBeCloseTo(0.005, 12)
    expect(afterStats.attackDamage / (beforeStats.attackDamage / 1.05)).toBeCloseTo(1.055, 12)
  })

  it('adds one kilogram of capacity for five STR', () => {
    const before = gameWithAttributes({ str: 10 })
    const after = gameWithAttributes({ str: 15 })
    expect(derivedStats(after.character, after.equipment).carryCapacity - derivedStats(before.character, before.equipment).carryCapacity).toBe(1)
  })

  it('uses DEX attack speed and never drops below 550 ms', () => {
    const game = gameWithAttributes({ dex: 20 })
    expect(derivedStats(game.character, game.equipment).attackIntervalMs).toBeCloseTo(2150 / 1.01, 8)
    game.character.attributes.dex = 1_000_000
    expect(derivedStats(game.character, game.equipment).attackIntervalMs).toBe(MIN_ATTACK_INTERVAL_MS)
  })

  it('uses DEX for accuracy and capped dodge', () => {
    const game = gameWithAttributes({ dex: 20 })
    const stats = derivedStats(game.character, game.equipment)
    expect(stats.accuracyBonus).toBeCloseTo(0.004, 12)
    expect(stats.dodge).toBeCloseTo(0.025, 12)
    expect(hitChance(stats.accuracyBonus, 0)).toBeCloseTo(0.954, 12)
    game.character.attributes.dex = 1_000_000
    expect(derivedStats(game.character, game.equipment).dodge).toBe(0.35)
  })

  it('adds 15 HP and 2 Armor for one VIT', () => {
    const before = gameWithAttributes({ vit: 10 })
    const after = gameWithAttributes({ vit: 11 })
    const beforeStats = derivedStats(before.character, before.equipment)
    const afterStats = derivedStats(after.character, after.equipment)
    expect(afterStats.maxHp - beforeStats.maxHp).toBe(15)
    expect(afterStats.armor - beforeStats.armor).toBe(2)
  })

  it('adds 4 Mana for INT and 3 Mana, regeneration, and resistance for WIS', () => {
    const base = gameWithAttributes({ int: 10, wis: 10 })
    const intelligence = gameWithAttributes({ int: 11, wis: 10 })
    const wisdom = gameWithAttributes({ int: 10, wis: 11 })
    const baseStats = derivedStats(base.character, base.equipment)
    const intStats = derivedStats(intelligence.character, intelligence.equipment)
    const wisStats = derivedStats(wisdom.character, wisdom.equipment)
    expect(intStats.maxMana - baseStats.maxMana).toBe(4)
    expect(wisStats.maxMana - baseStats.maxMana).toBe(3)
    expect(wisStats.manaRegenPerSecond - baseStats.manaRegenPerSecond).toBeCloseTo(0.04, 12)
    expect(wisStats.arcaneResistance - baseStats.arcaneResistance).toBe(3)
  })

  it('derives future Arcane damage and caps Item Rarity at 150%', () => {
    const game = gameWithAttributes({ int: 20, luk: 100_000 })
    const stats = derivedStats(game.character, game.equipment)
    expect(stats.arcaneDamageMultiplier).toBeCloseTo(1.1, 12)
    expect(stats.itemRarityBonus).toBe(1.5)
  })

  it('combines LUK and DEX crit contributions and caps critical chance', () => {
    const game = gameWithAttributes({ dex: 12, luk: 14 })
    const stats = derivedStats(game.character, game.equipment)
    expect(stats.critChance).toBeCloseTo(0.05 + 12 * 0.00015 + 14 * 0.0003, 12)
    game.character.attributes.dex = 100_000
    game.character.attributes.luk = 100_000
    expect(derivedStats(game.character, game.equipment).critChance).toBe(0.6)
  })

  it('uses diminishing physical and Arcane mitigation and respects both caps', () => {
    expect(mitigation(3000, 100)).toBeCloseTo(0.35294, 4)
    expect(mitigation(1_000_000, 1)).toBe(0.7)
    expect(arcaneMitigation(1_000_000, 1)).toBe(0.7)
  })

  it('derives a new character without persisting calculated values', () => {
    const game = createNewGame()
    const stats = derivedStats(game.character, game.equipment)
    expect(stats.maxHp).toBe(325)
    expect(stats.maxMana).toBe(134)
    expect(stats.attackDamage).toBeGreaterThan(16)
    const saved = JSON.stringify(game)
    for (const key of ['maxHp', 'maxMana', 'attackDamage', 'attackIntervalMs', 'arcaneResistance', 'itemRarityBonus']) expect(saved).not.toContain(`"${key}"`)
  })

  it('awards four attributes and one skill point per level', () => {
    const game = createNewGame()
    const leveled = addXp(game.character, 100)
    expect(leveled.level).toBe(2)
    expect(leveled.unspentAttributePoints).toBe(14)
    expect(leveled.skillPoints).toBe(2)
  })
})

describe('mana regeneration and deterministic combat', () => {
  it('regenerates mana from elapsed simulation time without exceeding Max Mana', () => {
    const game = createNewGame()
    const stats = derivedStats(game.character, game.equipment)
    const combat = createCombat(game.character, game.equipment, 0, stats.maxHp, stats.maxMana - 1, 3, 42)
    combat.basicAttackTimerMs = 100_000
    combat.enemies[0].attackTimerMs = 100_000
    const regenerated = advanceCombat(combat, 1000, game.character, game.equipment)
    expect(regenerated.playerMana).toBe(stats.maxMana)
    expect(regenerated.playerMana).toBeLessThanOrEqual(stats.maxMana)
  })

  it('repeats the same seeded hit and miss sequence', () => {
    const game = gameWithAttributes({ dex: 0 })
    const stats = derivedStats(game.character, game.equipment)
    const run = () => {
      let combat = createCombat(game.character, game.equipment, 5, stats.maxHp, stats.maxMana, 3, 19026)
      combat.enemies[0].dodge = 0.3
      for (let index = 0; index < 8 && combat.status === 'active'; index++) combat = advanceCombat(combat, 2200, game.character, game.equipment)
      return combat.log.filter((line) => line.includes('miss') || line.includes('Basic attack'))
    }
    expect(run()).toEqual(run())
    expect(run().length).toBeGreaterThan(0)
  })

  it('charges mana and starts Heavy Strike cooldown for a deterministic direct attack', () => {
    const game = createNewGame()
    const stats = derivedStats(game.character, game.equipment)
    const combat = createCombat(game.character, { weapon: starterWeapon, armor: starterArmor }, 0, stats.maxHp, stats.maxMana, 3, 42)
    const used = useAction(combat, 'heavy', game.character, game.equipment)
    expect(used.playerMana).toBe(stats.maxMana - 30)
    expect(used.cooldowns.heavy).toBe(7000)
  })
})

describe('deterministic rarity and save compatibility', () => {
  it('modifies rarity weights and normalizes them to 100%', () => {
    const weights = modifiedRarityWeights('Normal', 1)
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
    const rawTotal = 55 + 30 * 1.25 + 12 * 2 + 2.5 * 2.5 + 0.5 * 3
    expect(total).toBeCloseTo(100, 12)
    expect(Object.fromEntries(weights).Common).toBeCloseTo(55 / rawTotal * 100, 12)
    expect(Object.fromEntries(weights).Legendary).toBeCloseTo(1.5 / rawTotal * 100, 12)
  })

  it('produces the same complete item from a fixed loot seed', () => {
    expect(rollItem(12, 'Elite', 19026, 0.4)).toEqual(rollItem(12, 'Elite', 19026, 0.4))
  })

  it('loads an existing v1 save without derived fields or new runtime properties', () => {
    const existing = createNewGame()
    const values = new Map<string, string>([[SAVE_KEY, JSON.stringify(existing)]])
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    })
    const loaded: GameState = loadGame()
    expect(loaded).toEqual(existing)
    expect(loaded.version).toBe(1)
  })
})
