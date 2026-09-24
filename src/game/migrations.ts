import type { Attributes, Character, Equipment, Expedition, GameState, Item, ItemSlot, Rarity, Records, RoomKind } from './types'

export const CURRENT_SAVE_VERSION = 1 as const

export class SaveValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveValidationError'
  }
}

type Migrator = (save: Record<string, unknown>) => Record<string, unknown>

// Add a vN -> vN+1 function here whenever the durable schema version changes.
const migrations: Partial<Record<number, Migrator>> = {}

const rarities: readonly Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']
const itemSlots: readonly ItemSlot[] = ['weapon', 'armor']
const roomKinds: readonly RoomKind[] = ['combat', 'event', 'elite', 'shrine', 'boss']

function fail(path: string, expectation: string): never {
  throw new SaveValidationError(`${path} ${expectation}.`)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, path: string, required: readonly string[], optional: readonly string[] = []) {
  for (const key of required) if (!(key in value)) fail(`${path}.${key}`, 'is required')
  const allowed = new Set([...required, ...optional])
  const unexpected = Object.keys(value).find((key) => !allowed.has(key))
  if (unexpected) fail(`${path}.${unexpected}`, 'is not a recognized v1 field')
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) fail(path, 'must be a non-empty string')
  return value
}

function finiteNumber(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) fail(path, `must be a finite number of at least ${minimum}`)
  return value
}

function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) fail(path, `must be an integer from ${minimum} to ${maximum}`)
  return value as number
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
  return value
}

function enumValue<T extends string>(value: unknown, path: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail(path, `must be one of: ${values.join(', ')}`)
  return value as T
}

function validateAttributes(value: unknown, path: string): Attributes {
  const input = record(value, path)
  const keys: Array<keyof Attributes> = ['str', 'dex', 'vit', 'int', 'wis', 'luk']
  exactKeys(input, path, keys)
  return Object.fromEntries(keys.map((key) => [key, integer(input[key], `${path}.${key}`)])) as unknown as Attributes
}

function validateCharacter(value: unknown): Character {
  const input = record(value, 'character')
  exactKeys(input, 'character', ['name', 'level', 'xp', 'attributes', 'unspentAttributePoints', 'skillPoints'])
  return {
    name: string(input.name, 'character.name'),
    level: integer(input.level, 'character.level', 1, 100),
    xp: integer(input.xp, 'character.xp'),
    attributes: validateAttributes(input.attributes, 'character.attributes'),
    unspentAttributePoints: integer(input.unspentAttributePoints, 'character.unspentAttributePoints'),
    skillPoints: integer(input.skillPoints, 'character.skillPoints'),
  }
}

function validateItem(value: unknown, path: string, requiredSlot?: ItemSlot): Item {
  const input = record(value, path)
  exactKeys(input, path, ['id', 'name', 'slot', 'rarity', 'itemLevel', 'weight', 'enhancement', 'bonusStr', 'bonusVit', 'value'], ['baseDamage', 'armor'])
  const slot = enumValue(input.slot, `${path}.slot`, itemSlots)
  if (requiredSlot && slot !== requiredSlot) fail(`${path}.slot`, `must be ${requiredSlot}`)
  if (slot === 'weapon' && input.baseDamage === undefined) fail(`${path}.baseDamage`, 'is required for a weapon')
  if (slot === 'armor' && input.armor === undefined) fail(`${path}.armor`, 'is required for armor')
  if (slot === 'weapon' && input.armor !== undefined) fail(`${path}.armor`, 'is not valid for a weapon')
  if (slot === 'armor' && input.baseDamage !== undefined) fail(`${path}.baseDamage`, 'is not valid for armor')
  return {
    id: string(input.id, `${path}.id`),
    name: string(input.name, `${path}.name`),
    slot,
    rarity: enumValue(input.rarity, `${path}.rarity`, rarities),
    itemLevel: integer(input.itemLevel, `${path}.itemLevel`, 1),
    weight: finiteNumber(input.weight, `${path}.weight`),
    ...(slot === 'weapon' ? { baseDamage: finiteNumber(input.baseDamage, `${path}.baseDamage`, 0.000001) } : { armor: finiteNumber(input.armor, `${path}.armor`) }),
    enhancement: integer(input.enhancement, `${path}.enhancement`),
    bonusStr: integer(input.bonusStr, `${path}.bonusStr`),
    bonusVit: integer(input.bonusVit, `${path}.bonusVit`),
    value: integer(input.value, `${path}.value`),
  }
}

function validateEquipment(value: unknown): Equipment {
  const input = record(value, 'equipment')
  exactKeys(input, 'equipment', ['weapon', 'armor'])
  return { weapon: validateItem(input.weapon, 'equipment.weapon', 'weapon'), armor: validateItem(input.armor, 'equipment.armor', 'armor') }
}

function validateItems(value: unknown, path: string): Item[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  const items = value.map((item, index) => validateItem(item, `${path}[${index}]`))
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) fail(path, `must not contain duplicate item id ${item.id}`)
    ids.add(item.id)
  }
  return items
}

function validateExpedition(value: unknown): Expedition | null {
  if (value === null) return null
  const input = record(value, 'expedition')
  exactKeys(input, 'expedition', ['active', 'roomIndex', 'roomResolved', 'roomKinds', 'currentHp', 'currentMana', 'potionCharges', 'earnedGold', 'loot', 'seed'], ['blessing'])
  if (!Array.isArray(input.roomKinds) || input.roomKinds.length === 0) fail('expedition.roomKinds', 'must be a non-empty array')
  const kinds = input.roomKinds.map((kind, index) => enumValue(kind, `expedition.roomKinds[${index}]`, roomKinds))
  const roomIndex = integer(input.roomIndex, 'expedition.roomIndex', 0, kinds.length - 1)
  const blessing = input.blessing
  if (blessing !== undefined && blessing !== 'damage' && blessing !== 'armor') fail('expedition.blessing', 'must be damage or armor')
  return {
    active: boolean(input.active, 'expedition.active'),
    roomIndex,
    roomResolved: boolean(input.roomResolved, 'expedition.roomResolved'),
    roomKinds: kinds,
    currentHp: finiteNumber(input.currentHp, 'expedition.currentHp'),
    currentMana: finiteNumber(input.currentMana, 'expedition.currentMana'),
    potionCharges: integer(input.potionCharges, 'expedition.potionCharges'),
    earnedGold: integer(input.earnedGold, 'expedition.earnedGold'),
    loot: validateItems(input.loot, 'expedition.loot'),
    seed: integer(input.seed, 'expedition.seed', 0, 0xffffffff),
    ...(blessing === undefined ? {} : { blessing }),
  }
}

function validateRecords(value: unknown): Records {
  const input = record(value, 'records')
  exactKeys(input, 'records', ['dungeonsCleared', 'deaths', 'legendaryDrops', 'highestHit'])
  return {
    dungeonsCleared: integer(input.dungeonsCleared, 'records.dungeonsCleared'),
    deaths: integer(input.deaths, 'records.deaths'),
    legendaryDrops: integer(input.legendaryDrops, 'records.legendaryDrops'),
    highestHit: integer(input.highestHit, 'records.highestHit'),
  }
}

export function migrateSave(value: unknown): unknown {
  let save = structuredClone(record(value, 'save'))
  let version = integer(save.version, 'version', 1)
  if (version > CURRENT_SAVE_VERSION) throw new SaveValidationError(`Save version ${version} is newer than supported version ${CURRENT_SAVE_VERSION}.`)
  while (version < CURRENT_SAVE_VERSION) {
    const migrate = migrations[version]
    if (!migrate) throw new SaveValidationError(`No migration is available from save version ${version}.`)
    save = migrate(save)
    const nextVersion = integer(save.version, 'version', version + 1, version + 1)
    version = nextVersion
  }
  return save
}

export function validateGameState(value: unknown): GameState {
  const input = record(migrateSave(value), 'save')
  exactKeys(input, 'save', ['version', 'character', 'equipment', 'inventory', 'gold', 'enhancementStones', 'expedition', 'records', 'message'])
  const version = integer(input.version, 'version', CURRENT_SAVE_VERSION, CURRENT_SAVE_VERSION) as typeof CURRENT_SAVE_VERSION
  return {
    version,
    character: validateCharacter(input.character),
    equipment: validateEquipment(input.equipment),
    inventory: validateItems(input.inventory, 'inventory'),
    gold: integer(input.gold, 'gold'),
    enhancementStones: integer(input.enhancementStones, 'enhancementStones'),
    expedition: validateExpedition(input.expedition),
    records: validateRecords(input.records),
    message: string(input.message, 'message', true),
  }
}

export function parseSaveJson(raw: string): GameState {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SaveValidationError('Save file is not valid JSON.')
  }
  return validateGameState(parsed)
}

export function serializeSave(game: GameState, space?: number): string {
  return JSON.stringify(validateGameState(game), null, space)
}

export function saveErrorMessage(error: unknown): string {
  return error instanceof SaveValidationError ? error.message : 'The save could not be read.'
}
