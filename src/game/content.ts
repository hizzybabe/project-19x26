import { content, greenwood, type ItemBase, type MonsterDefinition } from './content-loader'
import { baseWeaponDamage, classStats, enemyBaseArmor, enemyBaseDamage, enemyBaseGold, enemyBaseHp, enemyBaseXp } from './rules'
import type { Enemy, Item } from './types'

function resolveStarterItem(base: ItemBase): Item {
  const { weaponFactor, ...rest } = base
  return base.slot === 'weapon'
    ? { ...rest, baseDamage: Math.round(baseWeaponDamage(base.itemLevel) * weaponFactor!) }
    : rest as Item
}

export const starterWeapon = resolveStarterItem(content.items.find(item => item.id === 'starter-greatsword')!)
export const starterArmor = resolveStarterItem(content.items.find(item => item.id === 'starter-armor')!)

function makeEnemy(definition: MonsterDefinition, playerLevel: number, instance: number): Enemy {
  const level = Math.max(1, playerLevel + definition.levelOffset)
  const mod = classStats(definition.enemyClass)
  const maxHp = Math.round(enemyBaseHp(level) * mod.hp)
  return {
    id: `${definition.id}-${instance}`, name: definition.name, level, enemyClass: definition.enemyClass,
    maxHp, hp: maxHp,
    damage: Math.round(enemyBaseDamage(level) * mod.damage),
    armor: Math.round(enemyBaseArmor(level) * mod.armor),
    dodge: definition.dodge, attackIntervalMs: definition.attackIntervalMs, attackTimerMs: 900,
    xp: Math.round(enemyBaseXp(level) * mod.xp), gold: Math.round(enemyBaseGold(level) * mod.gold),
    nextTelegraphMs: definition.firstTelegraphMs,
  }
}

export function encounterForRoom(roomIndex: number, level: number): Enemy[] {
  const room = greenwood.rooms[roomIndex]
  return room?.monsterIds.map((id, index) => makeEnemy(content.monsters.find(monster => monster.id === id)!, level, index)) ?? []
}
