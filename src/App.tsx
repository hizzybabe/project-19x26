import { useEffect, useMemo, useRef, useState } from 'react'
import { createAudioAdapter, gameEvents } from './game/events'
import {
  advanceCombat, attributeSummaries, beginExpedition, COMBAT_TICK_MS, continueExpedition, createCombat, createNewGame,
  derivedStats, itemWeight, loadGame, parseSaveJson, resolveRoomDefeat, resolveRoomEvent, resolveRoomVictory,
  retreatExpedition, saveErrorMessage, saveGame, serializeSave, useAction, xpRequired,
  greenwood, combatSkills, type CombatState, type EventChoice, type GameState, type Item, type SkillId,
} from './game'

const attributeKeys = ['str', 'dex', 'vit', 'int', 'wis', 'luk'] as const

function Bar({ value, max, tone = 'hp', label }: { value: number; max: number; tone?: 'hp' | 'mana' | 'xp'; label: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return <div className={`bar ${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.ceil(max)} aria-valuenow={Math.max(0, Math.min(Math.ceil(max), Math.ceil(value)))}><span style={{ width: `${percent}%` }} /><b>{Math.ceil(value)} / {Math.ceil(max)}</b></div>
}

function ItemCard({ item, equipped, onEquip, onDrop, onSell }: { item: Item; equipped?: Item; onEquip?: () => void; onDrop?: () => void; onSell?: () => void }) {
  const primary = item.slot === 'weapon' ? item.baseDamage ?? 0 : item.armor ?? 0
  const equippedPrimary = equipped ? (equipped.slot === 'weapon' ? equipped.baseDamage ?? 0 : equipped.armor ?? 0) : 0
  const difference = primary - equippedPrimary
  return <article className={`item-card ${item.rarity.toLowerCase()}`}>
    <header><span>{item.rarity}</span><small>IL {item.itemLevel}</small></header>
    <h4>{item.name}</h4>
    <p>{item.slot === 'weapon' ? `${primary} base damage` : `${primary} armor`} {equipped && <em className={difference >= 0 ? 'positive' : 'negative'}>({difference >= 0 ? '+' : ''}{difference})</em>}</p>
    {(item.bonusStr > 0 || item.bonusVit > 0) && <p>{item.bonusStr ? `+${item.bonusStr} STR ` : ''}{item.bonusVit ? `+${item.bonusVit} VIT` : ''}</p>}
    <p>{item.weight} kg · {item.value}g</p>
    <footer>
      {onEquip && <button onClick={onEquip}>EQUIP</button>}
      {onDrop && <button className="danger" onClick={onDrop}>DROP</button>}
      {onSell && <button onClick={onSell}>SELL</button>}
    </footer>
  </article>
}

function App() {
  const [game, setGame] = useState<GameState>(() => loadGame())
  const [combat, setCombat] = useState<CombatState | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const expedition = game.expedition

  const effectiveEquipment = useMemo(() => {
    const result = structuredClone(game.equipment)
    if (expedition?.blessing === 'damage' && result.weapon.baseDamage) result.weapon.baseDamage *= 1.15
    if (expedition?.blessing === 'armor' && result.armor.armor) result.armor.armor *= 1.2
    return result
  }, [game.equipment, expedition?.blessing])
  const stats = derivedStats(game.character, effectiveEquipment)
  const attributeDetails = attributeSummaries(game.character, effectiveEquipment)

  useEffect(() => {
    const audio = createAudioAdapter()
    audio.setEnabled(soundEnabled)
    return () => audio.dispose()
  }, [soundEnabled])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      if (!['1','2','3','4','5'].includes(event.key)) return
      const button = document.querySelector<HTMLButtonElement>(`[data-shortcut="${event.key}"]`)
      if (button && !button.disabled) { event.preventDefault(); button.click() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => { saveGame(game) }, [game])

  const roomKind = expedition?.roomKinds[expedition.roomIndex]
  const isCombatRoom = roomKind === 'combat' || roomKind === 'elite' || roomKind === 'boss'

  useEffect(() => {
    if (expedition?.active && !expedition.roomResolved && isCombatRoom && !combat) {
      setCombat(createCombat(game.character, effectiveEquipment, expedition.roomIndex, expedition.currentHp, expedition.currentMana, expedition.potionCharges, expedition.seed))
    }
  }, [combat, effectiveEquipment, expedition, game.character, isCombatRoom])

  useEffect(() => {
    if (!combat || combat.status !== 'active') return
    const timer = window.setInterval(() => setCombat((current) => current ? advanceCombat(current, COMBAT_TICK_MS, game.character, effectiveEquipment) : current), COMBAT_TICK_MS)
    return () => window.clearInterval(timer)
  }, [combat?.status, effectiveEquipment, game.character])

  useEffect(() => {
    if (!combat || !expedition || expedition.roomResolved || combat.status === 'active') return
    if (combat.status === 'lost') {
      setGame(resolveRoomDefeat)
      setCombat(null)
      gameEvents.emit({ type: 'player-defeated' })
      return
    }
    setGame((current) => resolveRoomVictory(current, combat))
    gameEvents.emit({ type: 'room-clear' })
  }, [combat, expedition])

  function startDungeon() {
    setCombat(null)
    setGame((current) => beginExpedition(current))
    gameEvents.emit({ type: 'dungeon-start' })
  }

  function resolveEvent(choice: EventChoice) {
    setGame((current) => resolveRoomEvent(current, choice))
  }

  function continueDungeon() {
    if (!expedition) return
    const cleared = expedition.roomIndex === expedition.roomKinds.length - 1
    setGame(continueExpedition)
    setCombat(null)
    if (cleared) gameEvents.emit({ type: 'dungeon-clear' })
  }

  function retreat() {
    if (!expedition || (combat && combat.status === 'active')) return
    setGame(retreatExpedition)
    setCombat(null)
  }

  function equipItem(item: Item, fromExpedition = false) {
    setGame((current) => {
      const source = fromExpedition ? current.expedition?.loot : current.inventory
      // Refuse the swap instead of splicing a missing index: splice(-1) would overwrite the last
      // pack entry, and splice on an empty source would destroy the replaced equipment outright.
      if (!source || !source.some((candidate) => candidate.id === item.id)) return current
      const next = structuredClone(current)
      const target = fromExpedition ? next.expedition!.loot : next.inventory
      const index = target.findIndex((candidate) => candidate.id === item.id)
      const old = next.equipment[item.slot]
      next.equipment[item.slot] = item
      target.splice(index, 1, old)
      next.message = `${item.name} equipped.`
      return next
    })
  }

  function dropRunItem(id: string) {
    setGame((current) => {
      const next = structuredClone(current)
      next.expedition!.loot = next.expedition!.loot.filter((item) => item.id !== id)
      return next
    })
  }

  function sellItem(item: Item) {
    setGame((current) => {
      const next = structuredClone(current)
      next.inventory = next.inventory.filter((candidate) => candidate.id !== item.id)
      next.gold += item.value
      next.message = `${item.name} sold for ${item.value} gold.`
      return next
    })
  }

  function spendAttribute(key: keyof GameState['character']['attributes']) {
    if (!game.character.unspentAttributePoints) return
    setGame((current) => {
      const next = structuredClone(current)
      next.character.attributes[key]++
      next.character.unspentAttributePoints--
      return next
    })
  }

  function performAction(action: SkillId) {
    setCombat((current) => {
      if (!current) return current
      const next = useAction(current, action, game.character, effectiveEquipment)
      if (next !== current) gameEvents.emit({ type: 'skill-used', skill: action })
      return next
    })
  }

  function exportSave() {
    const blob = new Blob([serializeSave(game, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'project-19x26-save.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importSave(file?: File) {
    if (!file) return
    try {
      const parsed = parseSaveJson(await file.text())
      setCombat(null)
      setGame(parsed)
    } catch (error) {
      setGame((current) => ({ ...current, message: `Import rejected: ${saveErrorMessage(error)}` }))
    }
  }

  const runWeight = expedition ? itemWeight(expedition.loot) : 0
  const capacity = stats.carryCapacity
  const canProceed = runWeight <= capacity
  const displayedHp = combat?.playerHp ?? expedition?.currentHp ?? stats.maxHp
  const displayedMana = combat?.playerMana ?? expedition?.currentMana ?? stats.maxMana

  return <div className="game-shell">
    <a className="skip-link" href="#main-game">Skip to game</a>
    <header className="titlebar">
      <div><span className="sigil">19×26</span><div><h1>PROJECT 19X26</h1><p>GREENWOOD PROTOTYPE · BUILD 0.2</p></div></div>
      <div className="currency"><span>GOLD <b>{game.gold}</b></span><span>STONES <b>{game.enhancementStones}</b></span><button type="button" aria-pressed={soundEnabled} onClick={() => setSoundEnabled(!soundEnabled)}>SOUND {soundEnabled ? 'ON' : 'OFF'}</button></div>
    </header>

    <main id="main-game" tabIndex={-1}>
      <aside className="panel character-panel">
        <h2>ADVENTURER</h2>
        <div className="portrait"><div className="pixel-knight">♜</div><span>LV {game.character.level}</span></div>
        <label>HP</label><Bar label="Hit points" value={displayedHp} max={stats.maxHp} />
        <label>MANA</label><Bar label="Mana" value={displayedMana} max={stats.maxMana} tone="mana" />
        <label>XP</label><Bar label="Experience" value={game.character.xp} max={xpRequired(game.character.level)} tone="xp" />
        <dl className="stat-grid">
          <div><dt>DMG</dt><dd>{Math.round(stats.attackDamage)}</dd></div><div><dt>ARMOR</dt><dd>{stats.armor}</dd></div>
          <div><dt>CRIT</dt><dd>{(stats.critChance * 100).toFixed(1)}%</dd></div><div><dt>CAP.</dt><dd>{capacity}kg</dd></div>
        </dl>
        {!expedition && <section className="attributes"><h3>ATTRIBUTES <small>{game.character.unspentAttributePoints} points</small></h3>{attributeKeys.map((key) => <article className="attribute-row" key={key}>
          <div className="attribute-heading"><span><b>{key.toUpperCase()}</b> <small>{attributeDetails[key].name}</small></span><strong>{game.character.attributes[key]}</strong></div>
          <p>{attributeDetails[key].current}</p>
          <footer><small>Next: {attributeDetails[key].next}</small><button aria-label={`Add one point to ${attributeDetails[key].name}`} onClick={() => spendAttribute(key)} disabled={!game.character.unspentAttributePoints}>+</button></footer>
        </article>)}</section>}
        <details className="derived-panel">
          <summary>DETAILED STATISTICS</summary>
          <dl>
            <div><dt>Max HP</dt><dd>{stats.maxHp}</dd></div>
            <div><dt>Max Mana</dt><dd>{stats.maxMana}</dd></div>
            <div><dt>Armor</dt><dd>{stats.armor}</dd></div>
            <div><dt>Physical Mitigation</dt><dd>{(stats.physicalMitigation * 100).toFixed(2)}%</dd></div>
            <div><dt>Arcane Resistance</dt><dd>{stats.arcaneResistance}</dd></div>
            <div><dt>Arcane Mitigation</dt><dd>{(stats.arcaneMitigation * 100).toFixed(2)}%</dd></div>
            <div><dt>Attack Damage</dt><dd>{stats.attackDamage.toFixed(2)}</dd></div>
            <div><dt>Attack Speed</dt><dd>+{(stats.attackSpeedBonus * 100).toFixed(2)}%</dd></div>
            <div><dt>Attack Interval</dt><dd>{(stats.attackIntervalMs / 1000).toFixed(3)}s</dd></div>
            <div><dt>Accuracy</dt><dd>+{(stats.accuracyBonus * 100).toFixed(2)}%</dd></div>
            <div><dt>Dodge</dt><dd>{(stats.dodge * 100).toFixed(2)}%</dd></div>
            <div><dt>Critical Chance</dt><dd>{(stats.critChance * 100).toFixed(2)}%</dd></div>
            <div><dt>Mana Regen</dt><dd>{stats.manaRegenPerSecond.toFixed(2)}/s</dd></div>
            <div><dt>Item Rarity</dt><dd>+{(stats.itemRarityBonus * 100).toFixed(2)}%</dd></div>
            <div><dt>Carry Capacity</dt><dd>{stats.carryCapacity} kg</dd></div>
            <div><dt>Arcane Damage</dt><dd>×{stats.arcaneDamageMultiplier.toFixed(3)}</dd></div>
          </dl>
        </details>
      </aside>

      <section className="center-stage">
        <div className="scene">
          <div className="scanlines" />
          {!expedition ? <div className="town-view"><span className="moon">●</span><div className="castle">▟██▙<br />▐▥▥▌<br />▐▥▥▌</div><h2>EMBERWATCH</h2><p>A quiet settlement at the edge of Greenwood.</p><button className="primary huge" onClick={startDungeon}>ENTER GREENWOOD</button></div>
          : <div className="dungeon-view">
            <div className="room-progress">{expedition.roomKinds.map((_, index) => <span key={index} className={index < expedition.roomIndex ? 'done' : index === expedition.roomIndex ? 'current' : ''}>{index + 1}</span>)}</div>
            <h2>ROOM {expedition.roomIndex + 1}: {greenwood.rooms[expedition.roomIndex]?.name}</h2>
            {isCombatRoom && combat && <>
              <div className="enemies">{combat.enemies.map((enemy) => <article key={enemy.id} className={enemy.hp <= 0 ? 'defeated' : ''}><div className="enemy-sprite" aria-hidden="true">{enemy.glyph}</div><h3>{enemy.name}</h3><small>{enemy.enemyClass} · Lv {enemy.level}</small><Bar label={`${enemy.name} hit points`} value={enemy.hp} max={enemy.maxHp} />{enemy.telegraph && <strong className="telegraph" role="alert">⚠ {enemy.telegraph.name} {(enemy.telegraph.remainingMs / 1000).toFixed(1)}s</strong>}</article>)}</div>
              <div className="actions">
                <button data-shortcut="1" onClick={() => performAction('heavy')} disabled={combat.playerMana < combatSkills.heavy.manaCost || combat.cooldowns.heavy > 0}>1 · HEAVY STRIKE<small>{combat.cooldowns.heavy > 0 ? `${Math.ceil(combat.cooldowns.heavy / 1000)}s` : `${combatSkills.heavy.manaCost} MP`}</small></button>
                <button data-shortcut="2" onClick={() => performAction('cleave')} disabled={combat.playerMana < combatSkills.cleave.manaCost || combat.cooldowns.cleave > 0}>2 · CLEAVE<small>{combat.cooldowns.cleave > 0 ? `${Math.ceil(combat.cooldowns.cleave / 1000)}s` : `${combatSkills.cleave.manaCost} MP`}</small></button>
                <button data-shortcut="3" onClick={() => performAction('execute')} disabled={combat.playerMana < combatSkills.execute.manaCost || combat.cooldowns.execute > 0}>3 · EXECUTE<small>{combat.cooldowns.execute > 0 ? `${Math.ceil(combat.cooldowns.execute / 1000)}s` : `${combatSkills.execute.manaCost} MP`}</small></button>
                <button data-shortcut="4" onClick={() => performAction('potion')} disabled={!combat.potionCharges || combat.potionCooldownMs > 0}>4 · POTION ×{combat.potionCharges}<small>{combat.potionCooldownMs > 0 ? `${Math.ceil(combat.potionCooldownMs / 1000)}s` : 'HEAL 30%'}</small></button>
                {combat.enemies.some((enemy) => enemy.telegraph) && <button data-shortcut="5" className="brace" onClick={() => performAction('brace')} disabled={combat.cooldowns.brace > 0}>5 · BRACE<small>{combat.cooldowns.brace > 0 ? `${Math.ceil(combat.cooldowns.brace / 1000)}s` : 'BLOCK 50%'}</small></button>}
              </div>
              <div className="combat-log" aria-label="Combat log">{combat.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</div>
            </>}
            {roomKind === 'event' && !expedition.roomResolved && <div className="choice"><div className="event-icon">♨</div><h3>HEALING FOUNTAIN</h3><p>Clear water rises from an ancient stone basin.</p><button onClick={() => resolveEvent('heal')}>DRINK · HEAL 30%</button><button onClick={() => resolveEvent('potion')}>BOTTLE · +1 POTION</button></div>}
            {roomKind === 'shrine' && !expedition.roomResolved && <div className="choice"><div className="event-icon">◆</div><h3>ANCIENT SHRINE</h3><p>A forgotten power answers only once.</p><button onClick={() => resolveEvent('damage')}>FURY · +15% DAMAGE</button><button onClick={() => resolveEvent('armor')}>STONE · +20% ARMOR</button></div>}
            {expedition.roomResolved && <div className="room-clear"><h3>ROOM CLEARED</h3><p>{game.message}</p><button className="primary" onClick={continueDungeon} disabled={!canProceed}>{expedition.roomIndex === expedition.roomKinds.length - 1 ? 'CLAIM VICTORY' : canProceed ? 'CONTINUE' : 'DROP LOOT TO CONTINUE'}</button><button onClick={retreat}>RETURN TO SETTLEMENT</button></div>}
          </div>}
        </div>
        <div className="message-line" role="status" aria-live="polite">› {game.message}</div>
      </section>

      <aside className="panel inventory-panel">
        <h2>{expedition ? 'DUNGEON PACK' : 'STASH'}</h2>
        {expedition && <p className={canProceed ? '' : 'overweight'}>{runWeight.toFixed(1)} / {capacity} kg</p>}
        <h3>EQUIPPED</h3>
        <ItemCard item={game.equipment.weapon} /><ItemCard item={game.equipment.armor} />
        <h3>{expedition ? 'FOUND THIS RUN' : `STORED ITEMS (${game.inventory.length})`}</h3>
        <div className="item-list">{(expedition ? expedition.loot : game.inventory).map((item) => <ItemCard key={item.id} item={item} equipped={game.equipment[item.slot]} onEquip={() => equipItem(item, Boolean(expedition))} onDrop={expedition ? () => dropRunItem(item.id) : undefined} onSell={!expedition ? () => sellItem(item) : undefined} />)}{(expedition ? expedition.loot : game.inventory).length === 0 && <p className="empty">No items.</p>}</div>
        {!expedition && <div className="save-tools"><button onClick={exportSave}>EXPORT SAVE</button><button onClick={() => importRef.current?.click()}>IMPORT SAVE</button><input ref={importRef} type="file" accept="application/json" hidden onChange={(event) => importSave(event.target.files?.[0])} /><button className="danger" onClick={() => { if (confirm('Erase all progress?')) { setCombat(null); setGame(createNewGame()) } }}>NEW GAME</button></div>}
      </aside>
    </main>
    <footer className="footer">LOCAL SAVE · NO ACCOUNT · BUILD-FOCUSED AUTO COMBAT</footer>
  </div>
}

export default App
