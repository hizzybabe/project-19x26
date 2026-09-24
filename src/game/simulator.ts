import { advanceCombat, createCombat, useAction } from './combat'
import { combatSkills, greenwood } from './content-loader'
import { rollDrops } from './loot'
import { validateGameState } from './migrations'
import { derivedStats, itemWeight } from './rules'
import { addXp, createNewGame } from './state'
import type { Equipment, GameState } from './types'

export interface DungeonResult { seed: number; outcome: 'cleared' | 'defeated'; roomsCleared: number; fightMs: number[]; gold: number; lootCount: number; finalState: GameState }
export interface BalanceReport { runs: number; clears: number; defeats: number; clearRate: number; averageFightSeconds: number[]; averageGold: number; averageLoot: number }

function blessedEquipment(equipment: Equipment, blessing?: 'damage' | 'armor'): Equipment {
  const effective = structuredClone(equipment)
  if (blessing === 'damage' && effective.weapon.baseDamage) effective.weapon.baseDamage *= 1.15
  if (blessing === 'armor' && effective.armor.armor) effective.armor.armor *= 1.2
  return effective
}

// Deliberately simple, deterministic test policy; not player-facing combat automation.
export function simulateDungeon(seed: number): DungeonResult {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Simulation seed must be a uint32.')
  const game = createNewGame()
  const run = { hp: derivedStats(game.character, game.equipment).maxHp, mana: derivedStats(game.character, game.equipment).maxMana, potions: 3, seed, gold: 0, loot: [] as GameState['inventory'], blessing: undefined as 'damage' | 'armor' | undefined }
  const fightMs: number[] = []
  let roomsCleared = 0
  for (let roomIndex = 0; roomIndex < greenwood.rooms.length; roomIndex++) {
    const room = greenwood.rooms[roomIndex]
    const stats = derivedStats(game.character, blessedEquipment(game.equipment, run.blessing))
    if (room.kind === 'event') run.hp = Math.min(stats.maxHp, run.hp + Math.round(stats.maxHp * 0.3))
    else if (room.kind === 'shrine') run.blessing = 'damage'
    else {
      const equipment = blessedEquipment(game.equipment, run.blessing)
      let combat = createCombat(game.character, equipment, roomIndex, run.hp, run.mana, run.potions, run.seed)
      for (let ticks = 0; combat.status === 'active' && ticks < 180; ticks++) {
        const currentStats = derivedStats(game.character, equipment)
        if (combat.playerHp < currentStats.maxHp * 0.5 && combat.potionCharges && combat.potionCooldownMs <= 0) combat = useAction(combat, 'potion', game.character, equipment)
        if (combat.enemies.some(enemy => enemy.telegraph) && !combat.braceActive && combat.cooldowns.brace <= 0) combat = useAction(combat, 'brace', game.character, equipment)
        if (combat.globalCooldownMs <= 0) {
          const action = combat.enemies.filter(enemy => enemy.hp > 0).length > 1 ? 'cleave' : 'heavy'
          if (combat.playerMana >= combatSkills[action].manaCost && combat.cooldowns[action] <= 0) combat = useAction(combat, action, game.character, equipment)
        }
        combat = advanceCombat(combat, 1000, game.character, equipment)
        if (!Number.isFinite(combat.playerHp) || !Number.isFinite(combat.playerMana) || combat.playerMana > currentStats.maxMana || combat.enemies.some(enemy => !Number.isFinite(enemy.hp))) throw new Error(`Invalid combat state at seed ${seed}, room ${roomIndex}`)
      }
      if (combat.status === 'active') throw new Error(`Combat timeout at seed ${seed}, room ${roomIndex}`)
      fightMs.push(combat.elapsedMs)
      run.seed = combat.seed
      if (combat.status === 'lost') {
        game.records.deaths++
        game.gold += Math.floor(run.gold * 0.5)
        game.inventory.push(...run.loot.slice(Math.ceil(run.loot.length * 0.25)))
        return { seed, outcome: 'defeated', roomsCleared, fightMs, gold: game.gold, lootCount: game.inventory.length, finalState: game }
      }
      run.hp = combat.playerHp
      run.mana = combat.playerMana
      run.potions = combat.potionCharges
      const enemies = combat.enemies
      game.character = addXp(game.character, enemies.reduce((sum, enemy) => sum + enemy.xp, 0))
      run.gold += enemies.reduce((sum, enemy) => sum + enemy.gold, 0)
      const strongest = enemies.reduce((a, b) => a.maxHp > b.maxHp ? a : b)
      const [drops, nextSeed] = rollDrops(strongest.level, strongest.enemyClass, run.seed, derivedStats(game.character, equipment).itemRarityBonus)
      run.loot.push(...drops)
      run.seed = nextSeed
      if (itemWeight(run.loot) > derivedStats(game.character, equipment).carryCapacity) {
        // The UI requires dropping excess loot before advancing; retain the earliest items.
        while (itemWeight(run.loot) > derivedStats(game.character, equipment).carryCapacity) run.loot.pop()
      }
    }
    roomsCleared++
    if (roomIndex < greenwood.rooms.length - 1) {
      const recovery = derivedStats(game.character, blessedEquipment(game.equipment, run.blessing))
      run.hp = Math.min(recovery.maxHp, run.hp + Math.round(recovery.maxHp * 0.02))
      run.mana = Math.min(recovery.maxMana, run.mana + Math.round(recovery.maxMana * 0.06))
    }
  }
  game.inventory.push(...run.loot)
  game.gold += run.gold
  game.records.dungeonsCleared++
  return { seed, outcome: 'cleared', roomsCleared, fightMs, gold: game.gold, lootCount: game.inventory.length, finalState: game }
}

export function simulateBalance(runs: number, firstSeed = 1): BalanceReport {
  if (!Number.isSafeInteger(runs) || runs < 1 || !Number.isSafeInteger(firstSeed) || firstSeed < 0 || firstSeed + runs - 1 > 0xffffffff) throw new Error('Invalid simulation range.')
  const times = Array(greenwood.rooms.filter(room => ['combat','elite','boss'].includes(room.kind)).length).fill(0) as number[]
  let clears = 0, gold = 0, loot = 0
  for (let index = 0; index < runs; index++) {
    const result = simulateDungeon(firstSeed + index)
    validateGameState(result.finalState)
    if (result.outcome === 'cleared') clears++
    gold += result.gold
    loot += result.lootCount
    result.fightMs.forEach((duration, room) => { times[room] += duration })
  }
  return { runs, clears, defeats: runs - clears, clearRate: clears / runs, averageFightSeconds: times.map(time => time / runs / 1000), averageGold: gold / runs, averageLoot: loot / runs }
}
