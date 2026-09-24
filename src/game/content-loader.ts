import itemsJson from './data/items.json'
import monstersJson from './data/monsters.json'
import skillsJson from './data/skills.json'
import dungeonsJson from './data/dungeons.json'
import eventsJson from './data/events.json'
import affixesJson from './data/affixes.json'
import legendaryPowersJson from './data/legendary-powers.json'
import type { EnemyClass, ItemSlot, Rarity, RoomKind } from './types'

type Entry = Record<string, unknown>
export interface ItemBase { id: string; name: string; slot: ItemSlot; rarity: Rarity; itemLevel: number; weight: number; weaponFactor?: number; armor?: number; enhancement: number; bonusStr: number; bonusVit: number; value: number }
export interface MonsterDefinition { id: string; name: string; enemyClass: EnemyClass; levelOffset: number; attackIntervalMs: number; dodge: number; firstTelegraphMs?: number }
export interface SkillDefinition { id: 'heavy' | 'cleave' | 'execute'; name: string; manaCost: number; cooldownMs: number; coefficient: number; lowHealthCoefficient?: number }
export interface RoomDefinition { name: string; kind: RoomKind; monsterIds: string[]; eventId?: string }
export interface DungeonDefinition { id: string; name: string; rooms: RoomDefinition[] }
export interface EventDefinition { id: string; name: string; choices: string[] }
export interface NamedDefinition { id: string; name: string }
export interface ContentCatalog { items: ItemBase[]; monsters: MonsterDefinition[]; skills: SkillDefinition[]; dungeons: DungeonDefinition[]; events: EventDefinition[]; affixes: NamedDefinition[]; legendaryPowers: NamedDefinition[] }

function invalid(path: string, reason: string): never { throw new Error(`Content ${path} ${reason}`) }
function object(value: unknown, path: string): Entry { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'must be an object'); return value as Entry }
function array(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) invalid(path, 'must be an array'); return value }
function keys(value: Entry, path: string, required: string[], optional: string[] = []) {
  for (const key of required) if (!(key in value)) invalid(`${path}.${key}`, 'is required')
  for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) invalid(`${path}.${key}`, 'is unknown')
}
function text(value: unknown, path: string): string { if (typeof value !== 'string' || !value.trim()) invalid(path, 'must be a nonempty string'); return value }
function number(value: unknown, path: string, min = 0): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min) invalid(path, `must be a finite number >= ${min}`); return value }
function integer(value: unknown, path: string, min = 0): number { const n = number(value, path, min); if (!Number.isSafeInteger(n)) invalid(path, 'must be an integer'); return n }
function oneOf<T extends string>(value: unknown, path: string, choices: readonly T[]): T { if (typeof value !== 'string' || !choices.includes(value as T)) invalid(path, `must be one of ${choices.join(', ')}`); return value as T }
function id(value: unknown, path: string): string { const result = text(value, path); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) invalid(path, 'must be lowercase kebab-case'); return result }
function collection<T>(raw: unknown, path: string, parse: (value: unknown, path: string) => T & { id: string }): T[] {
  const found = new Set<string>()
  return array(raw, path).map((value, index) => { const parsed = parse(value, `${path}[${index}]`); if (found.has(parsed.id)) invalid(path, `has duplicate id ${parsed.id}`); found.add(parsed.id); return parsed })
}

export function loadContent(raw: Record<keyof ContentCatalog, unknown>): ContentCatalog {
  const items = collection(raw.items, 'items', (value, path): ItemBase => {
    const input = object(value, path)
    keys(input, path, ['id','name','slot','rarity','itemLevel','weight','enhancement','bonusStr','bonusVit','value'], ['weaponFactor','armor'])
    const slot = oneOf(input.slot, `${path}.slot`, ['weapon','armor'] as const)
    if (slot === 'weapon' && input.weaponFactor === undefined) invalid(`${path}.weaponFactor`, 'is required for weapons')
    if (slot === 'armor' && input.armor === undefined) invalid(`${path}.armor`, 'is required for armor')
    if (slot === 'weapon' && input.armor !== undefined || slot === 'armor' && input.weaponFactor !== undefined) invalid(path, 'has a statistic for the wrong slot')
    return { id: id(input.id, `${path}.id`), name: text(input.name, `${path}.name`), slot, rarity: oneOf(input.rarity, `${path}.rarity`, ['Common','Uncommon','Rare','Epic','Legendary'] as const), itemLevel: integer(input.itemLevel, `${path}.itemLevel`, 1), weight: number(input.weight, `${path}.weight`), enhancement: integer(input.enhancement, `${path}.enhancement`), bonusStr: integer(input.bonusStr, `${path}.bonusStr`), bonusVit: integer(input.bonusVit, `${path}.bonusVit`), value: integer(input.value, `${path}.value`), ...(slot === 'weapon' ? { weaponFactor: number(input.weaponFactor, `${path}.weaponFactor`, 0.001) } : { armor: number(input.armor, `${path}.armor`) }) }
  })
  const monsters = collection(raw.monsters, 'monsters', (value, path): MonsterDefinition => { const x = object(value,path); keys(x,path,['id','name','enemyClass','levelOffset','attackIntervalMs','dodge'],['firstTelegraphMs']); const offset = number(x.levelOffset,`${path}.levelOffset`,-99); if (!Number.isSafeInteger(offset)) invalid(`${path}.levelOffset`,'must be an integer'); const dodge = number(x.dodge,`${path}.dodge`); if (dodge > 1) invalid(`${path}.dodge`,'must be <= 1'); return { id:id(x.id,`${path}.id`), name:text(x.name,`${path}.name`), enemyClass:oneOf(x.enemyClass,`${path}.enemyClass`,['Minion','Normal','Veteran','Elite','Boss'] as const), levelOffset:offset, attackIntervalMs:integer(x.attackIntervalMs,`${path}.attackIntervalMs`,1), dodge, ...(x.firstTelegraphMs === undefined ? {} : { firstTelegraphMs:integer(x.firstTelegraphMs,`${path}.firstTelegraphMs`,1) }) } })
  const skills = collection(raw.skills, 'skills', (value, path): SkillDefinition => { const x=object(value,path); keys(x,path,['id','name','manaCost','cooldownMs','coefficient'],['lowHealthCoefficient']); return { id:oneOf(x.id,`${path}.id`,['heavy','cleave','execute'] as const), name:text(x.name,`${path}.name`), manaCost:integer(x.manaCost,`${path}.manaCost`), cooldownMs:integer(x.cooldownMs,`${path}.cooldownMs`), coefficient:number(x.coefficient,`${path}.coefficient`,0.001), ...(x.lowHealthCoefficient === undefined ? {} : { lowHealthCoefficient:number(x.lowHealthCoefficient,`${path}.lowHealthCoefficient`,0.001) }) } })
  const events = collection(raw.events, 'events', (value, path): EventDefinition => { const x=object(value,path); keys(x,path,['id','name','choices']); return { id:id(x.id,`${path}.id`), name:text(x.name,`${path}.name`), choices:array(x.choices,`${path}.choices`).map((choice,i)=>id(choice,`${path}.choices[${i}]`)) } })
  const dungeons = collection(raw.dungeons, 'dungeons', (value, path): DungeonDefinition => { const x=object(value,path); keys(x,path,['id','name','rooms']); const rooms=array(x.rooms,`${path}.rooms`).map((room,i): RoomDefinition=>{ const p=`${path}.rooms[${i}]`, r=object(room,p); keys(r,p,['name','kind','monsterIds'],['eventId']); const monsterIds=array(r.monsterIds,`${p}.monsterIds`).map((monster,j)=>id(monster,`${p}.monsterIds[${j}]`)); for (const monster of monsterIds) if (!monsters.some(m=>m.id===monster)) invalid(`${p}.monsterIds` ,`references missing monster ${monster}`); if (r.eventId !== undefined && !events.some(e=>e.id===r.eventId)) invalid(`${p}.eventId`,`references missing event ${r.eventId}`); const kind=oneOf(r.kind,`${p}.kind`,['combat','event','elite','shrine','boss'] as const); if (['combat','elite','boss'].includes(kind) && !monsterIds.length) invalid(p,'requires monsters'); return { name:text(r.name,`${p}.name`), kind, monsterIds, ...(r.eventId === undefined ? {} : {eventId:id(r.eventId,`${p}.eventId`)}) } }); if (!rooms.length) invalid(`${path}.rooms`,'must not be empty'); return {id:id(x.id,`${path}.id`),name:text(x.name,`${path}.name`),rooms} })
  const named = (value: unknown, path: string): NamedDefinition => { const x=object(value,path); keys(x,path,['id','name']); return {id:id(x.id,`${path}.id`),name:text(x.name,`${path}.name`)} }
  for (const itemId of ['starter-greatsword','starter-armor']) if (!items.some(item => item.id === itemId)) invalid('items', `is missing required ${itemId}`)
  for (const skillId of ['heavy','cleave','execute']) if (!skills.some(skill => skill.id === skillId)) invalid('skills', `is missing required ${skillId}`)
  if (!dungeons.some(dungeon => dungeon.id === 'greenwood')) invalid('dungeons', 'is missing required greenwood')
  return {items,monsters,skills,dungeons,events,affixes:collection(raw.affixes,'affixes',named),legendaryPowers:collection(raw.legendaryPowers,'legendaryPowers',named)}
}

export const content = loadContent({ items:itemsJson, monsters:monstersJson, skills:skillsJson, dungeons:dungeonsJson, events:eventsJson, affixes:affixesJson, legendaryPowers:legendaryPowersJson })
export const greenwood = content.dungeons.find(dungeon => dungeon.id === 'greenwood')!
export const combatSkills = Object.fromEntries(content.skills.map(skill => [skill.id, skill])) as Record<SkillDefinition['id'], SkillDefinition>
