import type { Character, DerivedStats, Equipment, EnemyClass, Item } from './types'

export const BASE_ATTACK_INTERVAL_MS = 2150
export const MIN_ATTACK_INTERVAL_MS = 550

export const xpRequired = (level: number) => Math.round(100 * level ** 1.55)
export const baseWeaponDamage = (itemLevel: number) => 10 + 3 * itemLevel + 0.035 * itemLevel ** 2
export const enemyBaseHp = (level: number) => 35 + 15 * level + 2.2 * level ** 2
export const enemyBaseDamage = (level: number) => 4 + 1.2 * level + 0.05 * level ** 2
export const enemyBaseArmor = (level: number) => 10 + 6 * level + 0.15 * level ** 2
export const enemyBaseXp = (level: number) => 12 + 4 * level + 0.15 * level ** 2
export const enemyBaseGold = (level: number) => 4 + 0.9 * level + 0.015 * level ** 2

const classMultipliers: Record<EnemyClass, { hp: number; damage: number; armor: number; xp: number; gold: number }> = {
  Minion: { hp: 0.7, damage: 0.8, armor: 1, xp: 0.6, gold: 0.6 },
  Normal: { hp: 1, damage: 1, armor: 1, xp: 1, gold: 1 },
  Veteran: { hp: 1.35, damage: 1.15, armor: 1, xp: 1.25, gold: 1.25 },
  Elite: { hp: 2.4, damage: 1.45, armor: 1.15, xp: 3, gold: 3 },
  Boss: { hp: 6, damage: 1.7, armor: 1.2, xp: 8, gold: 8 },
}

export const classStats = (enemyClass: EnemyClass) => classMultipliers[enemyClass]

export function totalAttributes(character: Character, equipment: Equipment) {
  return {
    ...character.attributes,
    str: character.attributes.str + equipment.weapon.bonusStr + equipment.armor.bonusStr,
    vit: character.attributes.vit + equipment.weapon.bonusVit + equipment.armor.bonusVit,
  }
}

export function mitigation(rating: number, attackerLevel: number) {
  return Math.min(0.7, rating / (rating + 50 * attackerLevel + 500))
}

export const arcaneMitigation = mitigation

export function hitChance(accuracyBonus: number, targetDodge = 0) {
  return Math.min(0.98, Math.max(0.65, 0.95 + accuracyBonus - targetDodge))
}

export function derivedStats(character: Character, equipment: Equipment): DerivedStats {
  const attributes = totalAttributes(character, equipment)
  const weaponDamage = equipment.weapon.baseDamage ?? baseWeaponDamage(equipment.weapon.itemLevel) * 1.25
  const enhancement = 1 + equipment.weapon.enhancement * 0.05
  const maxHp = Math.round(150 + 25 * character.level + 15 * attributes.vit)
  const maxMana = Math.round(60 + 4 * character.level + 4 * attributes.int + 3 * attributes.wis)
  const armor = Math.round((equipment.armor.armor ?? 0) * (1 + equipment.armor.enhancement * 0.04) + attributes.vit * 2)
  const greatswordDamageBonus = attributes.str * 0.005
  const attackDamage = weaponDamage * enhancement * (1 + greatswordDamageBonus)
  const attackSpeedBonus = attributes.dex * 0.0005
  const attackIntervalMs = Math.max(MIN_ATTACK_INTERVAL_MS, BASE_ATTACK_INTERVAL_MS / (1 + attackSpeedBonus))
  const accuracyBonus = attributes.dex * 0.0002
  const dodge = Math.min(0.35, 0.02 + attributes.dex * 0.00025)
  const dexCritContribution = attributes.dex * 0.00015
  const luckCritContribution = attributes.luk * 0.0003
  const critChance = Math.min(0.6, 0.05 + luckCritContribution + dexCritContribution)
  const arcaneResistance = attributes.wis * 3
  const itemRarityBonus = Math.min(1.5, attributes.luk * 0.0015)
  const carryCapacity = 30 + Math.floor(attributes.str / 5)
  return {
    attributes,
    maxHp,
    maxMana,
    armor,
    physicalMitigation: mitigation(armor, character.level),
    arcaneResistance,
    arcaneMitigation: arcaneMitigation(arcaneResistance, character.level),
    attackDamage,
    greatswordDamageBonus,
    attackSpeedBonus,
    attackIntervalMs,
    accuracyBonus,
    dodge,
    critChance,
    dexCritContribution,
    luckCritContribution,
    manaRegenPerSecond: 1 + attributes.wis * 0.04,
    itemRarityBonus,
    carryCapacity,
    arcaneDamageMultiplier: 1 + attributes.int * 0.005,
  }
}

export type AttributeKey = keyof Character['attributes']

export function attributeSummaries(character: Character, equipment: Equipment): Record<AttributeKey, { name: string; current: string; next: string }> {
  const current = derivedStats(character, equipment)
  const withPoint = (key: AttributeKey) => {
    const nextCharacter = structuredClone(character)
    nextCharacter.attributes[key]++
    return derivedStats(nextCharacter, equipment)
  }
  const str = withPoint('str')
  const dex = withPoint('dex')
  const vit = withPoint('vit')
  const intelligence = withPoint('int')
  const wis = withPoint('wis')
  const luk = withPoint('luk')
  const percent = (value: number, digits = 2) => `${(value * 100).toFixed(digits).replace(/\.00$/, '')}%`
  const capacityGain = str.carryCapacity - current.carryCapacity
  return {
    str: {
      name: 'Strength',
      current: `Damage +${percent(current.greatswordDamageBonus, 1)} · Capacity +${current.carryCapacity - 30} kg`,
      next: `+${percent(str.greatswordDamageBonus - current.greatswordDamageBonus, 1)} damage${capacityGain ? `, +${capacityGain} kg capacity` : ''}`,
    },
    dex: {
      name: 'Dexterity',
      current: `Attack Speed +${percent(current.attackSpeedBonus, 2)} · Dodge ${percent(current.dodge, 2)} · Crit +${percent(current.dexCritContribution, 3)}`,
      next: `+${percent(dex.attackSpeedBonus - current.attackSpeedBonus, 2)} attack speed, +${percent(dex.dodge - current.dodge, 3)} dodge`,
    },
    vit: {
      name: 'Vitality',
      current: `Max HP +${current.attributes.vit * 15} · Armor +${current.attributes.vit * 2}`,
      next: `+${vit.maxHp - current.maxHp} Max HP, +${vit.armor - current.armor} Armor`,
    },
    int: {
      name: 'Intelligence',
      current: `Mana +${current.attributes.int * 4} · Arcane Damage ×${current.arcaneDamageMultiplier.toFixed(3)}`,
      next: `+${intelligence.maxMana - current.maxMana} Max Mana, +${percent(intelligence.arcaneDamageMultiplier - current.arcaneDamageMultiplier, 1)} arcane damage`,
    },
    wis: {
      name: 'Wisdom',
      current: `Mana +${current.attributes.wis * 3} · Regen ${current.manaRegenPerSecond.toFixed(2)}/s · Arcane Resist ${current.arcaneResistance}`,
      next: `+${wis.maxMana - current.maxMana} Max Mana, +${(wis.manaRegenPerSecond - current.manaRegenPerSecond).toFixed(2)}/s regen, +${wis.arcaneResistance - current.arcaneResistance} resist`,
    },
    luk: {
      name: 'Luck',
      current: `Crit +${percent(current.luckCritContribution, 2)} · Item Rarity +${percent(current.itemRarityBonus, 2)}`,
      next: `+${percent(luk.luckCritContribution - current.luckCritContribution, 2)} crit, +${percent(luk.itemRarityBonus - current.itemRarityBonus, 2)} item rarity`,
    },
  }
}

export function itemWeight(items: Item[]) {
  return items.reduce((total, item) => total + item.weight, 0)
}

export function carryCapacity(character: Character, equipment: Equipment) {
  return derivedStats(character, equipment).carryCapacity
}
