import { describe, expect, it } from 'vitest'
import { content, greenwood, loadContent } from './content-loader'
import { encounterForRoom, starterArmor, starterWeapon } from './content'
import { baseWeaponDamage } from './rules'

describe('validated JSON content', () => {
  it('resolves Greenwood rooms, enemies, and starter equipment', () => {
    expect(greenwood.rooms).toHaveLength(6)
    expect(encounterForRoom(2, 1).map(enemy => enemy.name)).toEqual(['Briar Wolf','Briar Wolf'])
    expect(starterWeapon.baseDamage).toBe(Math.round(baseWeaponDamage(1) * 1.25))
    expect(starterArmor.armor).toBe(18)
    expect(content.skills.map(skill => skill.id)).toEqual(['heavy','cleave','execute'])
  })

  it('rejects broken references before gameplay', () => {
    const raw = structuredClone(content)
    raw.dungeons[0].rooms[0].monsterIds = ['missing-monster']
    expect(() => loadContent(raw)).toThrow('references missing monster missing-monster')
  })

  it('rejects duplicate content IDs and invalid slot data', () => {
    const duplicated = structuredClone(content)
    duplicated.monsters.push(structuredClone(duplicated.monsters[0]))
    expect(() => loadContent(duplicated)).toThrow('duplicate id moss-slime')
    const wrongSlot = structuredClone(content)
    wrongSlot.items[0].armor = 10
    expect(() => loadContent(wrongSlot)).toThrow('statistic for the wrong slot')
  })

  it('requires a glyph and validates telegraph definitions before gameplay', () => {
    const missingGlyph = structuredClone(content)
    delete (missingGlyph.monsters[0] as { glyph?: string }).glyph
    expect(() => loadContent(missingGlyph)).toThrow('monsters[0].glyph is required')

    const badTelegraph = structuredClone(content)
    badTelegraph.monsters[4].telegraph!.damageMultiplier = 0
    expect(() => loadContent(badTelegraph)).toThrow('monsters[4].telegraph.damageMultiplier must be a finite number >= 0.001')

    const unknownKey = structuredClone(content)
    Object.assign(unknownKey.monsters[4].telegraph!, { extra: 1 })
    expect(() => loadContent(unknownKey)).toThrow('monsters[4].telegraph.extra is unknown')
  })
})
