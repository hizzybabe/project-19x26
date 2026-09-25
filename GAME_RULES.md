# Implemented Game Rules — Build 0.2

The complete design specification remains the long-term target. This file records the authoritative decisions actually implemented by the current build.

## Character and leveling

- Level starts at 1 and caps at 100.
- XP required from level `L`: `round(100 × L^1.55)`.
- A level grants 4 attribute points and 1 skill point.
- Starting attributes are 10 each, with 10 unspent points.
- Derived statistics are recalculated from character attributes and equipment and are never saved.

## Attributes and derived statistics

- STR: Greatsword damage multiplier is `1 + STR × 0.005`. Carry capacity is `30 + floor(STR / 5)` kg.
- DEX: attack-speed bonus is `DEX × 0.05%`; the 2.15-second Greatsword interval is divided by `1 + bonus` and cannot fall below 0.55 seconds. Accuracy is `DEX × 0.02%`. Dodge is `2% + DEX × 0.025%`, capped at 35%. DEX adds `0.015` percentage points of critical chance per point.
- VIT: Max HP is `150 + 25 × Level + 15 × VIT`. Armor is enhanced equipment armor plus `VIT × 2`.
- INT: Max Mana receives `INT × 4`. Arcane damage multiplier is `1 + INT × 0.005`; it is displayed but is not applied to Greatswords.
- WIS: Max Mana receives `WIS × 3`. Combat mana regeneration is `1 + WIS × 0.04` per second of simulation time. Arcane Resistance is `WIS × 3`.
- LUK: LUK adds `0.03` percentage points of critical chance and `0.15%` Item Rarity per point. Item Rarity is capped at +150%.

Critical chance is `5% + LUK × 0.03 percentage points + DEX × 0.015 percentage points`, capped at 60%.

Physical and Arcane mitigation use `Rating / (Rating + 50 × AttackerLevel + 500)` and are capped at 70%. The settlement statistics panel displays mitigation against a same-level attacker.

## Greatsword clarification

Generated `baseDamage` equals the generic weapon base formula multiplied by the Greatsword factor of 1.25. Combat uses that stored number directly. The factor is never applied twice.

Damage order in Build 0.2:

`stored weapon base × enhancement × STR scaling × random 90–110% × skill coefficient × critical × mitigation`

The Greenwood shrine modifies the stored weapon result by 1.15 for the current expedition only.

## Combat

- Basic attacks begin with a 2.15-second base interval modified by DEX.
- Player basic attacks and direct damaging skills make seeded hit rolls. Hit chance is `95% + Accuracy − Target Dodge`, clamped from 65% to 98%.
- Enemy basic attacks make seeded hit rolls against player Dodge. Enemies currently have zero Dodge, but their runtime data supports it.
- Telegraphed boss attacks cannot be dodged. Brace remains their intended defensive counter.
- Telegraphs are content data on each monster (`telegraph.name`, `windupMs`, `damageMultiplier`, `intervalMs`, `firstDelayMs`), never engine constants. The Dire Alpha uses Savage Pounce: 9,000 ms first delay, 3,000 ms windup, 2.2× damage, 12,000 ms repeat interval.
- The tick that arms a telegraph also decrements its windup, so a 3,000 ms windup resolves after a further 2,900 ms of simulation at the canonical 100 ms step. The warning window is therefore one step shorter than `windupMs`. This is implemented behavior, not a tuned target, and it is documented rather than corrected because changing it moves combat balance.
- Hit, damage variance, critical, enemy hit, and loot rarity rolls all consume the stored seeded RNG sequence.
- Mana regenerates during combat from elapsed simulation time and cannot exceed Max Mana.
- Skills have a 0.5-second global action delay.
- Heavy Strike: 190%, 30 mana, 7 seconds.
- Cleave: 130% to all enemies, 40 mana, 10 seconds.
- Execute: 150%, or 300% below 25% target HP; 35 mana, 12 seconds.
- Potion: 30% Max HP, 3 starting charges, 12 seconds.
- Brace: 50% reduction of the next telegraphed attack, 8 seconds.
- Rooms restore 2% Max HP and 6% Max Mana when continuing.

## Dungeon

The first dungeon is the fixed six-room Greenwood short dungeon:

1. Normal combat
2. Healing Fountain event
3. Multi-enemy combat
4. Elite
5. Ancient Shrine
6. Dire Alpha boss

Retreat outside combat keeps all current gold and items. Death retains half the expedition gold and loses 25% of backpack items, rounded upward. Equipped items and XP remain safe.

The player cannot proceed while backpack equipment exceeds capacity. Equipped items, gold, and enhancement stones have no backpack weight.

## Loot

Normal, elite, and boss rarity weights follow the v0.1 tables. Elite enemies guarantee one item with a 25% chance for a second. Bosses guarantee two with a 35% chance for a third. Normal enemies have a 35% item chance.

After the encounter class selects its base rarity table, Item Rarity modifies weights: Common is unchanged; Uncommon uses `1 + 0.25R`; Rare `1 + R`; Epic `1 + 1.5R`; Legendary `1 + 2R`. The result is normalized to 100%, where `R` is the capped decimal Item Rarity bonus.

Milestone 1 generates Greatswords and a combined armor prototype. Full slots and affix pools arrive with the content-schema milestone.

### Generated item formulas (Build 0.2)

These formulas are implemented in `loot.ts`. They are recorded here because they were previously only readable in code, and the Level 20 affix work depends on them.

- Rarity power: Common `1`, Uncommon `1.08`, Rare `1.18`, Epic `1.32`, Legendary `1.5`. Rarity sale value: Common `1`, Uncommon `1.25`, Rare `1.7`, Epic `2.7`, Legendary `5`.
- Slot roll: a single seeded roll below `0.56` produces a weapon, otherwise armor.
- Item level: enemy level plus a seeded offset — Normal `-1..1`, Elite `0..2`, Boss `1..3` — floored at 1.
- Weapon base damage: `round(baseWeaponDamage(itemLevel) × 1.25 × rarityPower)`. Armor: `round((5 + 0.75 × itemLevel + 0.012 × itemLevel²) × 2.24 × rarityPower)`.
- Bonus attribute: Common `0`; otherwise `max(1, round(itemLevel × 0.12 × rarityPower))`. Weapons roll it into STR, armor into VIT. No item rolls both.
- Sale value: `round((20 + 0.65 × itemLevel²) × 1.4 × rarityValue)` for weapons and `× 1.3` for armor.
- Weight is a flat `8` kg for weapons and `12` kg for armor.
- Display names are the base name plus a rarity suffix: ` of Vigor`, ` of Might`, ` of Kings`, ` of the Fallen Star` for Uncommon, Rare, Epic, and Legendary; Common has none. No MVP affix system exists yet, so the suffix is cosmetic.
- Enhancement scales stored weapon damage by `1 + 0.05 × enhancement` and stored armor by `1 + 0.04 × enhancement`.

No balance-specification deviations were required for Milestone 2 Task 1.

## Save validation

- Browser loading, autosave, JSON export, and JSON import share one v1 validator and serializer.
- Invalid imports do not replace the current game and report the failing field.
- Invalid browser saves start a fresh game with a visible explanation.
- Saves from newer versions are rejected. Older versions require an explicit sequential migrator; no undocumented legacy shape is inferred.
- Version 1 remains current, and derived statistics remain excluded from saved JSON.

## Simulation step

Combat advances by a caller-supplied fixed step. The canonical step is `COMBAT_TICK_MS` in `src/game/rules.ts`: **100 ms**. The UI advances by it and `simulator.ts` defaults to it, so a reported fight time describes what a player experiences. `simulateDungeon`/`simulateBalance` still accept `{ tickMs, maxFightMs }` for reproducible measurement at another step.

The step is not a balance rule, but it does move reported short-fight durations. Both 10,000-seed runs below use the same build and seeds:

| Step | 10,000-seed clear rate | Mean first room | Mean wolf room | Mean elite room | Mean boss room |
|---|---|---|---|---|---|
| 100 ms (canonical) | 0.97% (97 clears) | 2.55 s | 3.43 s | 15.06 s | 65.93 s |
| 1,000 ms | 0.99% (99 clears) | 2.96 s | 3.78 s | 15.33 s | 66.33 s |

Aggregate clear rate is step-insensitive within sampling noise. Short-fight means are not: an 8–14% spread on the two normal rooms comes from the fact that a step resolves at most one attack per combatant. Milestone 3 fight-time bands must therefore state the step they were measured at. The 10,000-seed suite costs about three minutes at the canonical step.

## Content and simulation policy

- Greenwood starter content is loaded from validated JSON; weapon factors are applied once when a starter weapon instance is resolved.
- The Milestone 2 simulator reuses production combat and loot rules. Its fixed test policy is described in `BALANCE_REPORT.md` and does not add player-facing automation.
- The 10,000-seed baseline found a 0.97% clear rate for an unallocated starter build at the canonical 100 ms step (0.99% at the earlier 1,000 ms step). This is a recorded tuning issue, not a change to combat rules.
- Every expedition transition lives in `src/game/expedition.ts` as a pure function; React only calls it. The death-loss rule is shared with the simulator through `defeatLoss`.
- Audio cues are optional, off by default, and never influence simulation state. Combat keyboard shortcuts are 1–5.
