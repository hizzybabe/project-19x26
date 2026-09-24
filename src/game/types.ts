export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'
export type EnemyClass = 'Minion' | 'Normal' | 'Veteran' | 'Elite' | 'Boss'
export type ItemSlot = 'weapon' | 'armor'

export interface Attributes {
  str: number
  dex: number
  vit: number
  int: number
  wis: number
  luk: number
}

export interface Item {
  id: string
  name: string
  slot: ItemSlot
  rarity: Rarity
  itemLevel: number
  weight: number
  baseDamage?: number
  armor?: number
  enhancement: number
  bonusStr: number
  bonusVit: number
  value: number
}

export interface Character {
  name: string
  level: number
  xp: number
  attributes: Attributes
  unspentAttributePoints: number
  skillPoints: number
}

export interface Equipment {
  weapon: Item
  armor: Item
}

export interface Enemy {
  id: string
  name: string
  level: number
  enemyClass: EnemyClass
  maxHp: number
  hp: number
  damage: number
  armor: number
  dodge?: number
  attackIntervalMs: number
  attackTimerMs: number
  xp: number
  gold: number
  telegraph?: { name: string; remainingMs: number; damageMultiplier: number }
  nextTelegraphMs?: number
}

export interface DerivedStats {
  attributes: Attributes
  maxHp: number
  maxMana: number
  armor: number
  physicalMitigation: number
  arcaneResistance: number
  arcaneMitigation: number
  attackDamage: number
  greatswordDamageBonus: number
  attackSpeedBonus: number
  attackIntervalMs: number
  accuracyBonus: number
  dodge: number
  critChance: number
  dexCritContribution: number
  luckCritContribution: number
  manaRegenPerSecond: number
  itemRarityBonus: number
  carryCapacity: number
  arcaneDamageMultiplier: number
}

export interface CombatState {
  status: 'active' | 'won' | 'lost'
  playerHp: number
  playerMana: number
  potionCharges: number
  potionCooldownMs: number
  basicAttackTimerMs: number
  globalCooldownMs: number
  cooldowns: Record<'heavy' | 'cleave' | 'execute' | 'brace', number>
  braceActive: boolean
  enemies: Enemy[]
  seed: number
  elapsedMs: number
  log: string[]
}

export type RoomKind = 'combat' | 'event' | 'elite' | 'shrine' | 'boss'

export interface Expedition {
  active: boolean
  roomIndex: number
  roomResolved: boolean
  roomKinds: RoomKind[]
  currentHp: number
  currentMana: number
  potionCharges: number
  earnedGold: number
  loot: Item[]
  seed: number
  blessing?: 'damage' | 'armor'
}

export interface GameState {
  version: 1
  character: Character
  equipment: Equipment
  inventory: Item[]
  gold: number
  enhancementStones: number
  expedition: Expedition | null
  records: Records
  message: string
}

export interface Records {
  dungeonsCleared: number
  deaths: number
  legendaryDrops: number
  highestHit: number
}
