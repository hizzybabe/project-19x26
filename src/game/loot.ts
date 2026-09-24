import { baseWeaponDamage } from './rules'
import { nextRandom, randomInt } from './rng'
import type { EnemyClass, Item, Rarity } from './types'

export const rarityTables: Record<'normal' | 'elite' | 'boss', Array<[Rarity, number]>> = {
  normal: [['Common', 55], ['Uncommon', 30], ['Rare', 12], ['Epic', 2.5], ['Legendary', 0.5]],
  elite: [['Common', 20], ['Uncommon', 35], ['Rare', 30], ['Epic', 13], ['Legendary', 2]],
  boss: [['Uncommon', 20], ['Rare', 50], ['Epic', 26], ['Legendary', 4]],
}

const rarityPower: Record<Rarity, number> = { Common: 1, Uncommon: 1.08, Rare: 1.18, Epic: 1.32, Legendary: 1.5 }
const rarityValue: Record<Rarity, number> = { Common: 1, Uncommon: 1.25, Rare: 1.7, Epic: 2.7, Legendary: 5 }

export function modifiedRarityWeights(enemyClass: EnemyClass, itemRarityBonus = 0): Array<[Rarity, number]> {
  const baseTable = rarityTables[enemyClass === 'Boss' ? 'boss' : enemyClass === 'Elite' ? 'elite' : 'normal']
  const rarityBonus = Math.min(1.5, Math.max(0, itemRarityBonus))
  const multipliers: Record<Rarity, number> = {
    Common: 1,
    Uncommon: 1 + 0.25 * rarityBonus,
    Rare: 1 + rarityBonus,
    Epic: 1 + 1.5 * rarityBonus,
    Legendary: 1 + 2 * rarityBonus,
  }
  const weighted = baseTable.map(([rarity, weight]) => [rarity, weight * multipliers[rarity]] as [Rarity, number])
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0)
  return weighted.map(([rarity, weight]) => [rarity, weight / total * 100])
}

function rollRarity(seed: number, enemyClass: EnemyClass, itemRarityBonus = 0): [Rarity, number] {
  const table = modifiedRarityWeights(enemyClass, itemRarityBonus)
  const [roll, nextSeed] = nextRandom(seed)
  let cursor = roll * 100
  for (const [rarity, chance] of table) {
    cursor -= chance
    if (cursor <= 0) return [rarity, nextSeed]
  }
  return [table[table.length - 1][0], nextSeed]
}

export function rollItem(level: number, enemyClass: EnemyClass, seed: number, itemRarityBonus = 0): [Item, number] {
  let current = seed
  let rarity: Rarity
  ;[rarity, current] = rollRarity(current, enemyClass, itemRarityBonus)
  let slotRoll: number
  ;[slotRoll, current] = nextRandom(current)
  let ilOffset: number
  ;[ilOffset, current] = randomInt(current, enemyClass === 'Boss' ? 1 : enemyClass === 'Elite' ? 0 : -1, enemyClass === 'Boss' ? 3 : enemyClass === 'Elite' ? 2 : 1)
  const itemLevel = Math.max(1, level + ilOffset)
  const power = rarityPower[rarity]
  const suffix = rarity === 'Legendary' ? ' of the Fallen Star' : rarity === 'Epic' ? ' of Kings' : rarity === 'Rare' ? ' of Might' : rarity === 'Uncommon' ? ' of Vigor' : ''
  const bonus = rarity === 'Common' ? 0 : Math.max(1, Math.round(itemLevel * 0.12 * power))
  const baseValue = 20 + 0.65 * itemLevel ** 2
  const id = `${slotRoll < 0.56 ? 'weapon' : 'armor'}-${seed}-${current}`
  if (slotRoll < 0.56) {
    return [{
      id,
      name: `Iron Greatsword${suffix}`,
      slot: 'weapon', rarity, itemLevel, weight: 8,
      baseDamage: Math.round(baseWeaponDamage(itemLevel) * 1.25 * power),
      enhancement: 0, bonusStr: bonus, bonusVit: 0,
      value: Math.round(baseValue * 1.4 * rarityValue[rarity]),
    }, current]
  }
  return [{
    id,
    name: `Forest Mail${suffix}`,
    slot: 'armor', rarity, itemLevel, weight: 12,
    armor: Math.round((5 + 0.75 * itemLevel + 0.012 * itemLevel ** 2) * 2.8 * 0.8 * power),
    enhancement: 0, bonusStr: 0, bonusVit: bonus,
    value: Math.round(baseValue * 1.3 * rarityValue[rarity]),
  }, current]
}

export function rollDrops(level: number, enemyClass: EnemyClass, seed: number, itemRarityBonus = 0): [Item[], number] {
  let current = seed
  let count = enemyClass === 'Boss' ? 2 : enemyClass === 'Elite' ? 1 : 0
  const [bonusRoll, nextSeed] = nextRandom(current)
  current = nextSeed
  if (enemyClass === 'Boss' && bonusRoll < 0.35) count++
  if (enemyClass === 'Elite' && bonusRoll < 0.25) count++
  if (!count && bonusRoll < 0.35) count = 1
  const items: Item[] = []
  for (let index = 0; index < count; index++) {
    let item: Item
    ;[item, current] = rollItem(level, enemyClass, current, itemRarityBonus)
    items.push(item)
  }
  return [items, current]
}
