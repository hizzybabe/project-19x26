import { rollDrops } from './loot'
import { derivedStats } from './rules'
import { addXp } from './state'
import type { CombatState, GameState, Item } from './types'

/**
 * Pure expedition transitions. React orchestrates these at stable boundaries; it must not
 * reimplement them. Every function returns a new state and never mutates its input.
 */

export type EventChoice = 'heal' | 'potion' | 'damage' | 'armor'

/** Death keeps all items except the first 25% (rounded up) and half of the unextracted gold. */
export function defeatLoss(loot: Item[], earnedGold: number) {
  const lostCount = Math.ceil(loot.length * 0.25)
  return { kept: loot.slice(lostCount), lostCount, gold: Math.floor(earnedGold * 0.5) }
}

export function resolveRoomVictory(game: GameState, combat: CombatState): GameState {
  if (!game.expedition) return game
  const next = structuredClone(game)
  const run = next.expedition!
  const enemies = combat.enemies
  const xp = enemies.reduce((sum, enemy) => sum + enemy.xp, 0)
  const gold = enemies.reduce((sum, enemy) => sum + enemy.gold, 0)
  const strongest = enemies.reduce((a, b) => (a.maxHp > b.maxHp ? a : b))
  const [drops, seed] = rollDrops(strongest.level, strongest.enemyClass, combat.seed, derivedStats(next.character, next.equipment).itemRarityBonus)

  next.character = addXp(next.character, xp)
  run.currentHp = combat.playerHp
  run.currentMana = combat.playerMana
  run.potionCharges = combat.potionCharges
  run.earnedGold += gold
  run.loot.push(...drops)
  run.seed = seed
  run.roomResolved = true
  next.enhancementStones += strongest.enemyClass === 'Boss' ? 3 : strongest.enemyClass === 'Elite' ? 1 : 0
  next.records.legendaryDrops += drops.filter(item => item.rarity === 'Legendary').length
  next.message = `Room cleared: +${xp} XP, +${gold} gold${drops.length ? `, ${drops.length} item${drops.length > 1 ? 's' : ''}` : ''}.`
  return next
}

export function resolveRoomDefeat(game: GameState): GameState {
  if (!game.expedition) return game
  const next = structuredClone(game)
  const run = next.expedition!
  const loss = defeatLoss(run.loot, run.earnedGold)
  next.inventory.push(...loss.kept)
  next.gold += loss.gold
  next.records.deaths++
  next.expedition = null
  next.message = `Defeated. ${loss.lostCount} item${loss.lostCount === 1 ? '' : 's'} and half the expedition gold were lost.`
  return next
}

export function resolveRoomEvent(game: GameState, choice: EventChoice): GameState {
  if (!game.expedition) return game
  const next = structuredClone(game)
  const run = next.expedition!
  const stats = derivedStats(next.character, next.equipment)
  if (choice === 'heal') run.currentHp = Math.min(stats.maxHp, run.currentHp + Math.round(stats.maxHp * 0.3))
  if (choice === 'potion') run.potionCharges++
  if (choice === 'damage' || choice === 'armor') run.blessing = choice
  run.roomResolved = true
  next.message = choice === 'heal' ? 'The fountain restores 30% maximum HP.'
    : choice === 'potion' ? 'You bottle a temporary potion charge.'
    : `The shrine grants +${choice === 'damage' ? '15% damage' : '20% armor'} for this dungeon.`
  return next
}

/** Advances one room, or extracts the run when the resolved room was the final one. */
export function continueExpedition(game: GameState): GameState {
  if (!game.expedition) return game
  const next = structuredClone(game)
  const run = next.expedition!
  if (run.roomIndex === run.roomKinds.length - 1) {
    next.inventory.push(...run.loot)
    next.gold += run.earnedGold
    next.records.dungeonsCleared++
    next.expedition = null
    next.message = `Greenwood cleared! Extracted ${run.loot.length} items and ${run.earnedGold} gold.`
    return next
  }
  const stats = derivedStats(next.character, next.equipment)
  run.currentHp = Math.min(stats.maxHp, run.currentHp + Math.round(stats.maxHp * 0.02))
  run.currentMana = Math.min(stats.maxMana, run.currentMana + Math.round(stats.maxMana * 0.06))
  run.roomIndex++
  run.roomResolved = false
  next.message = `Entering room ${run.roomIndex + 1}.`
  return next
}

/** Retreat outside combat extracts everything with no loss. */
export function retreatExpedition(game: GameState): GameState {
  if (!game.expedition) return game
  const next = structuredClone(game)
  const run = next.expedition!
  next.inventory.push(...run.loot)
  next.gold += run.earnedGold
  next.expedition = null
  next.message = `Retreated safely with ${run.loot.length} items and ${run.earnedGold} gold.`
  return next
}
