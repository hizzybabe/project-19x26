import { describe, expect, it } from 'vitest'
import {
  CURRENT_SAVE_VERSION, parseSaveJson, SaveValidationError, serializeSave, validateGameState,
} from './migrations'
import { beginExpedition, createNewGame, loadGame, SAVE_KEY } from './state'

function memoryStorage(initial?: string) {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(SAVE_KEY, initial)
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  })
  return values
}

describe('v1 save validation and migration pipeline', () => {
  it('passes a complete v1 save through losslessly without changing its version', () => {
    const game = beginExpedition(createNewGame())
    const validated = validateGameState(game)
    expect(validated).toEqual(game)
    expect(validated.version).toBe(CURRENT_SAVE_VERSION)
  })

  it('round-trips exported JSON through the shared parser', () => {
    const game = createNewGame()
    game.gold = 246
    game.character.attributes.luk = 17
    expect(parseSaveJson(serializeSave(game, 2))).toEqual(game)
  })

  it('reports malformed JSON clearly', () => {
    expect(() => parseSaveJson('{broken')).toThrowError(new SaveValidationError('Save file is not valid JSON.'))
  })

  it('rejects a missing required field with its exact path', () => {
    const save = structuredClone(createNewGame()) as unknown as Record<string, unknown>
    delete save.character
    expect(() => validateGameState(save)).toThrow('save.character is required.')
  })

  it('rejects unrecognized persisted fields, including derived statistics', () => {
    const save = structuredClone(createNewGame()) as unknown as Record<string, unknown>
    save.maxHp = 999
    expect(() => validateGameState(save)).toThrow('save.maxHp is not a recognized v1 field.')
  })

  it('rejects save versions newer than this build', () => {
    const save = { ...createNewGame(), version: 2 }
    expect(() => validateGameState(save)).toThrow('Save version 2 is newer than supported version 1.')
  })

  it('rejects invalid character ranges', () => {
    const save = createNewGame()
    save.character.level = 101
    expect(() => validateGameState(save)).toThrow('character.level must be an integer from 1 to 100.')
  })

  it('rejects slot-incompatible equipment', () => {
    const save = createNewGame()
    const broken = structuredClone(save) as unknown as { equipment: { weapon: Record<string, unknown> } }
    broken.equipment.weapon.slot = 'armor'
    expect(() => validateGameState(broken)).toThrow('equipment.weapon.slot must be weapon.')
  })

  it('rejects corrupt expedition room indexes', () => {
    const save = beginExpedition(createNewGame())
    save.expedition!.roomIndex = 99
    expect(() => validateGameState(save)).toThrow('expedition.roomIndex must be an integer from 0 to 5.')
  })

  it('rejects duplicate item identifiers within an inventory', () => {
    const save = createNewGame()
    save.inventory = [structuredClone(save.equipment.weapon), structuredClone(save.equipment.weapon)]
    expect(() => validateGameState(save)).toThrow('inventory must not contain duplicate item id starter-greatsword.')
  })

  it('starts safely with a visible reason when local save data is corrupt', () => {
    memoryStorage('{broken')
    const loaded = loadGame()
    expect(loaded.version).toBe(1)
    expect(loaded.message).toContain('Save file is not valid JSON.')
    expect(loaded.message).toContain('A new game was started.')
  })

  it('keeps derived values out of serialized saves', () => {
    const serialized = serializeSave(createNewGame())
    for (const key of ['maxHp', 'maxMana', 'attackDamage', 'attackIntervalMs', 'arcaneResistance', 'itemRarityBonus']) expect(serialized).not.toContain(`"${key}"`)
  })
})
