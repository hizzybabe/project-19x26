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

No balance-specification deviations were required for Milestone 2 Task 1.

## Save validation

- Browser loading, autosave, JSON export, and JSON import share one v1 validator and serializer.
- Invalid imports do not replace the current game and report the failing field.
- Invalid browser saves start a fresh game with a visible explanation.
- Saves from newer versions are rejected. Older versions require an explicit sequential migrator; no undocumented legacy shape is inferred.
- Version 1 remains current, and derived statistics remain excluded from saved JSON.

## Content and simulation policy

- Greenwood starter content is loaded from validated JSON; weapon factors are applied once when a starter weapon instance is resolved.
- The Milestone 2 simulator reuses production combat and loot rules. Its fixed test policy is described in `BALANCE_REPORT.md` and does not add player-facing automation.
- The 10,000-seed baseline found a 0.99% clear rate for an unallocated starter build. This is a recorded tuning issue, not a change to combat rules.
- Audio cues are optional, off by default, and never influence simulation state. Combat keyboard shortcuts are 1–5.
