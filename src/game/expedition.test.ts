import { describe, expect, it } from 'vitest'
import { createCombat } from './combat'
import { continueExpedition, defeatLoss, resolveRoomDefeat, resolveRoomEvent, resolveRoomVictory, retreatExpedition } from './expedition'
import { rollDrops } from './loot'
import { validateGameState } from './migrations'
import { derivedStats } from './rules'
import { beginExpedition, createNewGame } from './state'
import type { CombatState, GameState, Item, Rarity } from './types'

function startedRun(seed = 19026): GameState {
  const game = beginExpedition(createNewGame())
  game.expedition!.seed = seed
  return game
}

function wonCombat(game: GameState, roomIndex = 0, seed = 19026): CombatState {
  return { ...createCombat(game.character, game.equipment, roomIndex, game.expedition!.currentHp, game.expedition!.currentMana, game.expedition!.potionCharges, seed), status: 'won' }
}

function items(count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`, name: `Item ${index}`, slot: 'armor', rarity: 'Common' as Rarity, itemLevel: 1,
    weight: 1, armor: 1, enhancement: 0, bonusStr: 0, bonusVit: 0, value: 1,
  }))
}

describe('pure expedition transitions', () => {
  it('resolves a room victory without mutating its input', () => {
    const game = startedRun()
    const snapshot = structuredClone(game)
    const combat = wonCombat(game)
    const next = resolveRoomVictory(game, combat)

    expect(game).toEqual(snapshot)
    expect(next.expedition!.roomResolved).toBe(true)
    expect(next.expedition!.currentHp).toBe(combat.playerHp)
    expect(next.expedition!.currentMana).toBe(combat.playerMana)
    expect(next.expedition!.potionCharges).toBe(combat.potionCharges)
    // The run seed advances past the loot rolls, so the next room continues the same stream.
    const strongest = combat.enemies.reduce((a, b) => a.maxHp > b.maxHp ? a : b)
    const afterLoot = rollDrops(strongest.level, strongest.enemyClass, combat.seed, derivedStats(game.character, game.equipment).itemRarityBonus)[1]
    expect(next.expedition!.seed).toBe(afterLoot)
    expect(next.expedition!.seed).not.toBe(combat.seed)
    expect(next.expedition!.earnedGold).toBeGreaterThan(0)
    // Room 0 holds a single Moss Slime: 16 XP and 3 gold, and 16 XP does not reach level 2.
    const xp = combat.enemies.reduce((sum, enemy) => sum + enemy.xp, 0)
    const gold = combat.enemies.reduce((sum, enemy) => sum + enemy.gold, 0)
    expect(next.character.xp).toBe(xp)
    expect(next.character.level).toBe(1)
    expect(next.expedition!.earnedGold).toBe(gold)
    expect(next.message).toContain('Room cleared')
    expect(validateGameState(next)).toEqual(next)
  })

  it('is pure enough for React to invoke it twice with identical results', () => {
    const game = startedRun()
    const combat = wonCombat(game, 2)
    expect(resolveRoomVictory(game, combat)).toEqual(resolveRoomVictory(game, combat))
    expect(resolveRoomDefeat(game)).toEqual(resolveRoomDefeat(game))
    expect(continueExpedition(game)).toEqual(continueExpedition(game))
    expect(retreatExpedition(game)).toEqual(retreatExpedition(game))
  })

  it('grants enhancement stones and legendary records by encounter class', () => {
    const elite = resolveRoomVictory(startedRun(), wonCombat(startedRun(), 3))
    const boss = resolveRoomVictory(startedRun(), wonCombat(startedRun(), 5))
    expect(elite.enhancementStones).toBe(1)
    expect(boss.enhancementStones).toBe(3)
    expect(elite.records.legendaryDrops).toBe(elite.expedition!.loot.filter(item => item.rarity === 'Legendary').length)
    expect(boss.records.legendaryDrops).toBe(boss.expedition!.loot.filter(item => item.rarity === 'Legendary').length)
    expect(resolveRoomVictory(startedRun(), wonCombat(startedRun(), 0)).enhancementStones).toBe(0)
  })

  it('loses the first quarter of the pack and half the run gold on defeat', () => {
    const game = startedRun()
    game.expedition!.loot = items(4)
    game.expedition!.earnedGold = 101
    const next = resolveRoomDefeat(game)

    expect(next.expedition).toBeNull()
    expect(next.gold).toBe(50)
    expect(next.inventory.map(item => item.id)).toEqual(['item-1', 'item-2', 'item-3'])
    expect(next.records.deaths).toBe(1)
    expect(next.message).toBe('Defeated. 1 item and half the expedition gold were lost.')
    expect(validateGameState(next)).toEqual(next)
  })

  it('rounds the defeat loss up and describes more than one lost item', () => {
    const game = startedRun()
    game.expedition!.loot = items(5)
    const next = resolveRoomDefeat(game)
    expect(next.inventory.map(item => item.id)).toEqual(['item-2', 'item-3', 'item-4'])
    expect(next.message).toBe('Defeated. 2 items and half the expedition gold were lost.')
    expect(defeatLoss(items(5), 10)).toEqual({ kept: items(5).slice(2), lostCount: 2, gold: 5 })
    expect(defeatLoss([], 7)).toEqual({ kept: [], lostCount: 0, gold: 3 })
  })

  it('keeps the defeat loss rule in one place for the UI and the simulator', () => {
    for (const count of [0, 1, 2, 3, 4, 5, 9]) {
      const { kept, lostCount, gold } = defeatLoss(items(count), 100)
      expect(lostCount).toBe(Math.ceil(count * 0.25))
      expect(kept.length + lostCount).toBe(count)
      expect(gold).toBe(50)
    }
  })

  it('applies fountain healing up to Max HP and never beyond it', () => {
    const game = startedRun()
    const stats = derivedStats(game.character, game.equipment)
    game.expedition!.currentHp = stats.maxHp - 10
    const healed = resolveRoomEvent(game, 'heal')
    expect(healed.expedition!.currentHp).toBe(stats.maxHp)
    expect(healed.expedition!.roomResolved).toBe(true)
    expect(resolveRoomEvent(healed, 'heal').expedition!.currentHp).toBe(stats.maxHp)
  })

  it('adds a potion charge and sets the shrine blessing', () => {
    const game = startedRun()
    game.expedition!.potionCharges = 3
    expect(resolveRoomEvent(game, 'potion').expedition!.potionCharges).toBe(4)
    expect(resolveRoomEvent(game, 'damage').expedition!.blessing).toBe('damage')
    expect(resolveRoomEvent(game, 'armor').expedition!.blessing).toBe('armor')
    expect(resolveRoomEvent(game, 'armor').message).toContain('+20% armor')
  })

  it('advances a room with recovery and extracts on the final room', () => {
    const game = startedRun()
    game.expedition!.loot = items(2)
    game.expedition!.earnedGold = 40
    const stats = derivedStats(game.character, game.equipment)
    game.expedition!.currentHp = 1
    game.expedition!.currentMana = 1
    game.expedition!.roomResolved = true

    const advanced = continueExpedition(game)
    expect(advanced.expedition!.roomIndex).toBe(1)
    expect(advanced.expedition!.roomResolved).toBe(false)
    expect(advanced.expedition!.currentHp).toBe(1 + Math.round(stats.maxHp * 0.02))
    expect(advanced.expedition!.currentMana).toBe(1 + Math.round(stats.maxMana * 0.06))
    expect(advanced.message).toBe('Entering room 2.')

    const last = structuredClone(game)
    last.expedition!.roomIndex = last.expedition!.roomKinds.length - 1
    const cleared = continueExpedition(last)
    expect(cleared.expedition).toBeNull()
    expect(cleared.gold).toBe(40)
    expect(cleared.inventory).toHaveLength(2)
    expect(cleared.records.dungeonsCleared).toBe(1)
    expect(validateGameState(cleared)).toEqual(cleared)
  })

  it('extracts everything on retreat', () => {
    const game = startedRun()
    game.expedition!.loot = items(3)
    game.expedition!.earnedGold = 12
    const next = retreatExpedition(game)
    expect(next.expedition).toBeNull()
    expect(next.gold).toBe(12)
    expect(next.inventory).toHaveLength(3)
    expect(next.message).toBe('Retreated safely with 3 items and 12 gold.')
    expect(validateGameState(next)).toEqual(next)
  })

  it('returns the unchanged game when no expedition is active', () => {
    const idle = createNewGame()
    expect(resolveRoomVictory(idle, wonCombat(startedRun()))).toBe(idle)
    expect(resolveRoomDefeat(idle)).toBe(idle)
    expect(resolveRoomEvent(idle, 'heal')).toBe(idle)
    expect(continueExpedition(idle)).toBe(idle)
    expect(retreatExpedition(idle)).toBe(idle)
  })

  it('rolls drops from the strongest enemy in a mixed room', () => {
    const game = startedRun(4242)
    const combat = wonCombat(game, 2, 4242)
    const strongest = combat.enemies.reduce((a, b) => a.maxHp > b.maxHp ? a : b)
    expect(combat.enemies.map(enemy => enemy.enemyClass)).toEqual(['Normal', 'Minion'])
    expect(strongest.enemyClass).toBe('Normal')
    const next = resolveRoomVictory(game, combat)
    expect(next.expedition!.loot).toEqual(rollDrops(strongest.level, strongest.enemyClass, combat.seed, derivedStats(game.character, game.equipment).itemRarityBonus)[0])
  })
})
