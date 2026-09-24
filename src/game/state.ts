import { starterArmor, starterWeapon } from './content'
import { greenwood } from './content-loader'
import { parseSaveJson, saveErrorMessage, serializeSave } from './migrations'
import { derivedStats, xpRequired } from './rules'
import type { Character, GameState } from './types'

export const SAVE_KEY = 'project-19x26-save-v1'

export function createNewGame(): GameState {
  const character: Character = {
    name: 'Adventurer', level: 1, xp: 0,
    attributes: { str: 10, dex: 10, vit: 10, int: 10, wis: 10, luk: 10 },
    unspentAttributePoints: 10, skillPoints: 1,
  }
  return {
    version: 1, character,
    equipment: { weapon: structuredClone(starterWeapon), armor: structuredClone(starterArmor) },
    inventory: [], gold: 0, enhancementStones: 0, expedition: null,
    records: { dungeonsCleared: 0, deaths: 0, legendaryDrops: 0, highestHit: 0 },
    message: 'The road to Greenwood is open.',
  }
}

export function addXp(character: Character, amount: number): Character {
  const next = structuredClone(character)
  next.xp += amount
  while (next.level < 100 && next.xp >= xpRequired(next.level)) {
    next.xp -= xpRequired(next.level)
    next.level++
    next.unspentAttributePoints += 4
    next.skillPoints += 1
  }
  return next
}

export function beginExpedition(game: GameState): GameState {
  const next = structuredClone(game)
  const stats = derivedStats(next.character, next.equipment)
  next.expedition = {
    active: true, roomIndex: 0, roomResolved: false,
    roomKinds: greenwood.rooms.map(room => room.kind),
    currentHp: stats.maxHp, currentMana: stats.maxMana, potionCharges: 3,
    earnedGold: 0, loot: [], seed: (Date.now() >>> 0) || 1,
  }
  next.message = 'You enter Greenwood.'
  return next
}

export function saveGame(game: GameState) {
  localStorage.setItem(SAVE_KEY, serializeSave(game))
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return createNewGame()
    return parseSaveJson(raw)
  } catch (error) {
    const game = createNewGame()
    game.message = `Saved progress could not be loaded: ${saveErrorMessage(error)} A new game was started.`
    return game
  }
}
